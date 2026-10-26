import type { QueryFilter, Types } from 'mongoose';
import {
  levelFromXp,
  titleForLevel,
  unlockedLevelTitles,
  type Achievement as AchievementDto,
  type AdminMission,
  type CountryCode,
  type CountryStanding,
  type LeaderboardEntry,
  type Mission as MissionDto,
  type MissionCadence,
  type MissionUpdateInput,
  type Pulse as PulseDto,
  type ProgressionSnapshot,
  type RegionStanding,
  type TnRegion,
  type TrackableEvent,
  type XpEntry,
} from '@tgh/shared';
import { bus } from '../../core/events/bus';
import { AppError, isDuplicateKeyError } from '../../core/http/errors';
import { iso, toObjectId } from '../../core/http/utils';
import { dayKey, nextDailyReset, nextWeeklyReset, weekKey } from '../../core/time/periods';
import { User, type UserDoc } from '../users/user.model';
import { avatarUrlOf } from '../users/users.mapper';
import {
  Achievement,
  Mission,
  MissionProgress,
  Pulse,
  SeasonStat,
  UserAchievement,
  UserCounter,
  XpLedger,
  type AchievementDoc,
  type MissionDoc,
  type MissionProgressDoc,
  type PulseDoc,
} from './progression.model';

/** Concurrent first-time upserts can race on a unique index; the retry finds the winner's row. */
async function retryOnDuplicate<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isDuplicateKeyError(error)) return operation();
    throw error;
  }
}

/* ───────────── Pulse & season ───────────── */

export async function activePulse(now = new Date()): Promise<PulseDoc | null> {
  return Pulse.findOne({ startsAt: { $lte: now }, endsAt: { $gte: now } })
    .sort({ startsAt: -1 })
    .lean<PulseDoc>();
}

async function contributeToPulse(pulse: PulseDoc, amount: number): Promise<void> {
  // Atomic $inc returning the pre-image: exactly one award crosses each milestone.
  const before = await Pulse.findOneAndUpdate(
    { _id: pulse._id },
    { $inc: { current: amount } },
    { returnDocument: 'before' },
  ).lean<PulseDoc>();
  if (!before) return;
  const after = before.current + amount;
  for (const milestone of before.milestones) {
    if (before.current < milestone.threshold && after >= milestone.threshold) {
      bus.emit('pulse.milestone', {
        pulseKey: before.key,
        pulseTitle: before.title,
        threshold: milestone.threshold,
        label: milestone.label,
        reward: milestone.reward,
      });
    }
  }
}

export async function toPulseDto(pulse: PulseDoc): Promise<PulseDto> {
  const contributors = await SeasonStat.countDocuments({ seasonKey: pulse.key, xp: { $gt: 0 } });
  return {
    key: pulse.key,
    title: pulse.title,
    description: pulse.description,
    goal: pulse.goal,
    current: pulse.current,
    progress: Math.min(1, pulse.current / pulse.goal),
    startsAt: pulse.startsAt.toISOString(),
    endsAt: pulse.endsAt.toISOString(),
    contributors,
    milestones: pulse.milestones.map((m) => ({ ...m, reached: pulse.current >= m.threshold })),
  };
}

export async function currentPulse(): Promise<PulseDto | null> {
  const pulse = await activePulse();
  return pulse ? toPulseDto(pulse) : null;
}

/* ───────────── XP ───────────── */

/**
 * The only way XP enters the system. The ledger row is written first; its
 * unique idempotency key turns retries and double-claims into no-ops.
 * Returns false when this award was already granted.
 */
export async function awardXp(userId: string, amount: number, reason: string, idempotencyKey: string, grantedBy: string | null = null): Promise<boolean> {
  if (amount <= 0) return false;
  const season = await activePulse();

  try {
    await XpLedger.create({ userId, amount, reason, idempotencyKey, seasonKey: season?.key ?? null, grantedBy });
  } catch (error) {
    if (isDuplicateKeyError(error)) return false;
    throw error;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { xp: amount } },
    { returnDocument: 'after', projection: { xp: 1, level: 1 } },
  ).lean<Pick<UserDoc, '_id' | 'xp' | 'level'>>();
  if (!user) return false;

  const { level } = levelFromXp(user.xp);
  if (level > user.level) {
    // Conditional update: concurrent awards can't announce the same level twice.
    const result = await User.updateOne({ _id: userId, level: { $lt: level } }, { $set: { level } });
    if (result.modifiedCount === 1) bus.emit('progression.level_up', { userId, level, previousLevel: user.level });
  }

  if (season) {
    await retryOnDuplicate(() =>
      SeasonStat.updateOne({ seasonKey: season.key, userId }, { $inc: { xp: amount } }, { upsert: true }),
    );
    await contributeToPulse(season, amount);
  }
  bus.emit('progression.xp_awarded', { userId, amount, seasonKey: season?.key ?? null });
  return true;
}

export async function xpHistory(userId: string, limit = 20): Promise<XpEntry[]> {
  const rows = await XpLedger.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
  return rows.map((row) => ({ id: String(row._id), amount: row.amount, reason: row.reason, createdAt: row.createdAt.toISOString() }));
}

export async function snapshot(userId: string): Promise<ProgressionSnapshot> {
  const user = await User.findById(userId).select('xp level equippedTitle').lean<Pick<UserDoc, 'xp' | 'level' | 'equippedTitle'>>();
  if (!user) throw AppError.notFound('Player');
  const progress = levelFromXp(user.xp);
  const season = await activePulse();

  let seasonXp = 0;
  let seasonRank: number | null = null;
  if (season) {
    const stat = await SeasonStat.findOne({ seasonKey: season.key, userId }).lean();
    seasonXp = stat?.xp ?? 0;
    if (seasonXp > 0) {
      seasonRank = (await SeasonStat.countDocuments({ seasonKey: season.key, xp: { $gt: seasonXp } })) + 1;
    }
  }

  return {
    xp: user.xp,
    level: progress.level,
    title: user.equippedTitle ?? titleForLevel(progress.level),
    currentLevelXp: progress.currentLevelXp,
    nextLevelXp: progress.nextLevelXp,
    progress: progress.progress,
    seasonKey: season?.key ?? null,
    seasonXp,
    seasonRank,
  };
}

/* ───────────── Missions ───────────── */

function periodKeyFor(cadence: MissionCadence, now: Date): string {
  if (cadence === 'daily') return dayKey(now);
  if (cadence === 'weekly') return weekKey(now);
  return 'special';
}

function resetFor(mission: MissionDoc, now: Date): Date | null {
  if (mission.cadence === 'daily') return nextDailyReset(now);
  if (mission.cadence === 'weekly') return nextWeeklyReset(now);
  return mission.endsAt;
}

function activeMissionFilter(now: Date): QueryFilter<MissionDoc> {
  return {
    active: true,
    $or: [
      { cadence: { $in: ['daily', 'weekly'] as MissionCadence[] } },
      { cadence: 'special', startsAt: { $lte: now }, endsAt: { $gte: now } },
    ],
  };
}

function toMissionDto(mission: MissionDoc, progress: MissionProgressDoc | undefined, now: Date): MissionDto {
  return {
    id: String(mission._id),
    code: mission.code,
    title: mission.title,
    description: mission.description,
    cadence: mission.cadence,
    event: mission.event,
    target: mission.target,
    progress: Math.min(progress?.progress ?? 0, mission.target),
    xpReward: mission.xpReward,
    periodKey: periodKeyFor(mission.cadence, now),
    resetsAt: iso(resetFor(mission, now)),
    completedAt: iso(progress?.completedAt),
    claimedAt: iso(progress?.claimedAt),
  };
}

async function advanceMissions(event: TrackableEvent, userId: string, now: Date): Promise<void> {
  const missions = await Mission.find({ ...activeMissionFilter(now), event }).lean<MissionDoc[]>();
  for (const mission of missions) {
    const periodKey = periodKeyFor(mission.cadence, now);
    const progress = await retryOnDuplicate(() =>
      MissionProgress.findOneAndUpdate(
        { userId, missionId: mission._id, periodKey },
        { $inc: { progress: 1 } },
        { upsert: true, returnDocument: 'after' },
      ).lean<MissionProgressDoc>(),
    );
    if (progress && progress.progress >= mission.target && !progress.completedAt) {
      await MissionProgress.updateOne({ _id: progress._id, completedAt: null }, { $set: { completedAt: now } });
    }
  }
}

export async function listMissions(userId: string): Promise<MissionDto[]> {
  const now = new Date();
  const missions = await Mission.find(activeMissionFilter(now)).sort({ order: 1 }).lean<MissionDoc[]>();
  if (missions.length === 0) return [];

  const progressRows = await MissionProgress.find({
    userId,
    $or: missions.map((m) => ({ missionId: m._id, periodKey: periodKeyFor(m.cadence, now) })),
  }).lean<MissionProgressDoc[]>();
  const byMission = new Map(progressRows.map((row) => [String(row.missionId), row]));

  return missions.map((mission) => toMissionDto(mission, byMission.get(String(mission._id)), now));
}

export async function claimMission(userId: string, missionId: string): Promise<{ mission: MissionDto; progression: ProgressionSnapshot }> {
  const now = new Date();
  const mission = await Mission.findOne({ _id: missionId, ...activeMissionFilter(now) }).lean<MissionDoc>();
  if (!mission) throw AppError.notFound('Mission');
  const periodKey = periodKeyFor(mission.cadence, now);

  const claimed = await MissionProgress.findOneAndUpdate(
    { userId, missionId, periodKey, completedAt: { $ne: null }, claimedAt: null },
    { $set: { claimedAt: now } },
    { returnDocument: 'after' },
  ).lean<MissionProgressDoc>();

  if (!claimed) {
    const existing = await MissionProgress.findOne({ userId, missionId, periodKey }).lean<MissionProgressDoc>();
    if (existing?.claimedAt) throw AppError.conflict('Reward already claimed');
    throw AppError.unprocessable('Finish the mission before claiming');
  }

  await awardXp(userId, mission.xpReward, `Mission · ${mission.title}`, `mission:${userId}:${missionId}:${periodKey}`);
  return { mission: toMissionDto(mission, claimed, now), progression: await snapshot(userId) };
}

/* ───────────── Achievements ───────────── */

export async function unlock(userId: string, achievement: AchievementDoc): Promise<void> {
  try {
    await UserAchievement.create({ userId, achievementId: achievement._id });
  } catch (error) {
    if (isDuplicateKeyError(error)) return;
    throw error;
  }
  await awardXp(userId, achievement.xpReward, `Achievement · ${achievement.title}`, `ach:${userId}:${achievement.code}`);
  bus.emit('achievement.unlocked', { userId, code: achievement.code, title: achievement.title, xpReward: achievement.xpReward });
}

async function unlockEligible(userId: string, candidates: AchievementDoc[]): Promise<void> {
  if (candidates.length === 0) return;
  const owned = await UserAchievement.find({ userId, achievementId: { $in: candidates.map((a) => a._id) } })
    .select('achievementId')
    .lean();
  const ownedIds = new Set(owned.map((row) => String(row.achievementId)));
  for (const achievement of candidates) {
    if (!ownedIds.has(String(achievement._id))) await unlock(userId, achievement);
  }
}

export async function unlockByLevel(userId: string, level: number): Promise<void> {
  const candidates = await Achievement.find({ 'criteria.kind': 'level', 'criteria.level': { $lte: level } }).lean<AchievementDoc[]>();
  await unlockEligible(userId, candidates);
}

/** Entry point for every trackable domain event. */
export async function track(event: TrackableEvent, userId: string): Promise<void> {
  const now = new Date();
  const counter = await retryOnDuplicate(() =>
    UserCounter.findOneAndUpdate({ userId, event }, { $inc: { count: 1 } }, { upsert: true, returnDocument: 'after' }).lean(),
  );
  const count = counter?.count ?? 1;

  await advanceMissions(event, userId, now);
  const candidates = await Achievement.find({
    'criteria.kind': 'event_count',
    'criteria.event': event,
    'criteria.count': { $lte: count },
  }).lean<AchievementDoc[]>();
  await unlockEligible(userId, candidates);
}

export async function listAchievements(userId: string | null): Promise<AchievementDto[]> {
  const [defs, players, counts, mine] = await Promise.all([
    Achievement.find().sort({ order: 1 }).lean<AchievementDoc[]>(),
    User.estimatedDocumentCount(),
    UserAchievement.aggregate<{ _id: Types.ObjectId; n: number }>([{ $group: { _id: '$achievementId', n: { $sum: 1 } } }]),
    userId ? UserAchievement.find({ userId }).lean() : Promise.resolve([]),
  ]);
  const countById = new Map(counts.map((row) => [String(row._id), row.n]));
  const unlockedById = new Map(mine.map((row) => [String(row.achievementId), row.unlockedAt]));

  return defs.map((def) => ({
    id: String(def._id),
    code: def.code,
    title: def.title,
    description: def.description,
    xpReward: def.xpReward,
    cosmetic: def.cosmetic ?? null,
    unlockedAt: iso(unlockedById.get(String(def._id))),
    rarity: players > 0 ? Math.round(((countById.get(String(def._id)) ?? 0) / players) * 1000) / 10 : 0,
  }));
}

export async function unlockedAchievements(userId: string): Promise<Array<{ code: string; title: string; unlockedAt: string }>> {
  const rows = await UserAchievement.find({ userId }).sort({ unlockedAt: -1 }).lean();
  const defs = await Achievement.find({ _id: { $in: rows.map((r) => r.achievementId) } }).lean<AchievementDoc[]>();
  const byId = new Map(defs.map((d) => [String(d._id), d]));
  return rows.flatMap((row) => {
    const def = byId.get(String(row.achievementId));
    return def ? [{ code: def.code, title: def.title, unlockedAt: row.unlockedAt.toISOString() }] : [];
  });
}

/** Level titles plus titles won from achievements. */
export async function availableTitles(userId: string, level: number): Promise<string[]> {
  const rows = await UserAchievement.find({ userId }).select('achievementId').lean();
  const defs = await Achievement.find({
    _id: { $in: rows.map((r) => r.achievementId) },
    'cosmetic.kind': 'title',
  }).lean<AchievementDoc[]>();
  return [...unlockedLevelTitles(level), ...defs.map((d) => d.cosmetic!.value)];
}

/* ───────────── Standings ───────────── */

export async function leaderboard(limit = 25): Promise<LeaderboardEntry[]> {
  const season = await activePulse();
  if (!season) return [];
  const stats = await SeasonStat.find({ seasonKey: season.key, xp: { $gt: 0 } }).sort({ xp: -1 }).limit(limit).lean();
  const users = await User.find({ _id: { $in: stats.map((s) => s.userId) }, status: 'active' })
    .select('username displayName avatarColor avatarMediaId level country region equippedTitle')
    .lean<UserDoc[]>();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  return stats.flatMap((stat, index) => {
    const user = byId.get(String(stat.userId));
    if (!user) return [];
    return [
      {
        rank: index + 1,
        xp: stat.xp,
        user: {
          id: String(user._id),
          username: user.username,
          displayName: user.displayName,
          avatarColor: user.avatarColor,
          avatarUrl: avatarUrlOf(user),
          level: user.level,
          country: user.country ?? (user.region && user.region !== 'Abroad' ? 'TN' : null),
          region: user.region,
          title: user.equippedTitle ?? titleForLevel(user.level),
        },
      },
    ];
  });
}

/** Season XP by country — the world view next to the governorate one. */
export async function countryStandings(): Promise<CountryStanding[]> {
  const season = await activePulse();
  if (!season) return [];
  const rows = await SeasonStat.aggregate<{ _id: CountryCode; xp: number; players: number }>([
    { $match: { seasonKey: season.key, xp: { $gt: 0 } } },
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user', pipeline: [{ $project: { country: 1, region: 1 } }] } },
    { $unwind: '$user' },
    // Older accounts have only a governorate; they count for Tunisia.
    { $set: { country: { $ifNull: ['$user.country', { $cond: [{ $and: [{ $ne: ['$user.region', null] }, { $ne: ['$user.region', 'Abroad'] }] }, 'TN', null] }] } } },
    { $match: { country: { $ne: null } } },
    { $group: { _id: '$country', xp: { $sum: '$xp' }, players: { $sum: 1 } } },
    { $sort: { xp: -1 } },
  ]);
  return rows.map((row) => ({ country: row._id, xp: row.xp, players: row.players }));
}

export async function regionStandings(): Promise<RegionStanding[]> {
  const season = await activePulse();
  if (!season) return [];
  const rows = await SeasonStat.aggregate<{ _id: TnRegion; xp: number; players: number }>([
    { $match: { seasonKey: season.key, xp: { $gt: 0 } } },
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user', pipeline: [{ $project: { region: 1 } }] } },
    { $unwind: '$user' },
    { $match: { 'user.region': { $nin: [null, 'Abroad'] } } },
    { $group: { _id: '$user.region', xp: { $sum: '$xp' }, players: { $sum: 1 } } },
    { $sort: { xp: -1 } },
  ]);
  return rows.map((row) => ({ region: row._id, xp: row.xp, players: row.players }));
}

export async function seasonStatFor(userId: string): Promise<{ seasonXp: number; seasonRank: number | null }> {
  const { seasonXp, seasonRank } = await snapshot(userId);
  return { seasonXp, seasonRank };
}

/* ───────────── Admin ───────────── */

export function toAdminMission(mission: MissionDoc): AdminMission {
  return {
    id: String(mission._id),
    code: mission.code,
    title: mission.title,
    description: mission.description,
    cadence: mission.cadence,
    event: mission.event,
    target: mission.target,
    xpReward: mission.xpReward,
    active: mission.active,
    startsAt: iso(mission.startsAt),
    endsAt: iso(mission.endsAt),
  };
}

export async function adminListMissions(): Promise<AdminMission[]> {
  const missions = await Mission.find().sort({ cadence: 1, order: 1 }).lean<MissionDoc[]>();
  return missions.map(toAdminMission);
}

export async function adminUpdateMission(id: string, input: MissionUpdateInput): Promise<AdminMission> {
  const mission = await Mission.findByIdAndUpdate(toObjectId(id), { $set: input }, { returnDocument: 'after' }).lean<MissionDoc>();
  if (!mission) throw AppError.notFound('Mission');
  return toAdminMission(mission);
}
