import { randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import {
  levelFromXp,
  type AchievementInput,
  type AdminAchievement,
  type AdminMission,
  type AdminSeason,
  type AdminXpAdjustment,
  type MissionCreateInput,
  type SeasonInput,
  type XpAdjustInput,
} from '@tgh/shared';
import { AppError } from '../../core/http/errors';
import { toObjectId } from '../../core/http/utils';
import { logger } from '../../core/logger';
import { User, type UserDoc } from '../users/user.model';
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
  type PulseDoc,
} from './progression.model';
import { activePulse, awardXp, toAdminMission, unlock } from './progression.service';

/** "Weekend warrior!" → "weekend-warrior", plus a short random tail so codes never clash. */
const codeFor = (prefix: string, title: string) =>
  `${prefix}-${title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32)}-${randomBytes(2).toString('hex')}`;

/* ───────────── Missions ───────────── */

export async function adminCreateMission(input: MissionCreateInput): Promise<AdminMission> {
  const last = await Mission.findOne().sort({ order: -1 }).select('order').lean<Pick<MissionDoc, 'order'>>();
  const special = input.cadence === 'special';
  const mission = await Mission.create({
    ...input,
    code: codeFor('custom', input.title),
    startsAt: special ? input.startsAt : null,
    endsAt: special ? input.endsAt : null,
    order: (last?.order ?? 0) + 1,
  });
  return toAdminMission(mission.toObject());
}

/** Removes the mission and everyone's progress on it. XP already claimed from it stays. */
export async function adminDeleteMission(id: string): Promise<void> {
  const result = await Mission.deleteOne({ _id: toObjectId(id) });
  if (result.deletedCount === 0) throw AppError.notFound('Mission');
  await MissionProgress.deleteMany({ missionId: toObjectId(id) });
}

/* ───────────── Achievements ───────────── */

async function toAdminAchievements(docs: AchievementDoc[]): Promise<AdminAchievement[]> {
  const counts = await UserAchievement.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { achievementId: { $in: docs.map((doc) => doc._id) } } },
    { $group: { _id: '$achievementId', n: { $sum: 1 } } },
  ]);
  const byId = new Map(counts.map((row) => [String(row._id), row.n]));
  return docs.map((doc) => ({
    id: String(doc._id),
    code: doc.code,
    title: doc.title,
    description: doc.description,
    criteria:
      doc.criteria.kind === 'level'
        ? { kind: 'level', level: doc.criteria.level }
        : { kind: 'event_count', event: doc.criteria.event, count: doc.criteria.count },
    xpReward: doc.xpReward,
    cosmetic: doc.cosmetic ?? null,
    unlocked: byId.get(String(doc._id)) ?? 0,
  }));
}

export async function adminListAchievements(): Promise<AdminAchievement[]> {
  return toAdminAchievements(await Achievement.find().sort({ order: 1 }).lean<AchievementDoc[]>());
}

/**
 * Players who already meet a new or changed achievement get it now instead of
 * at their next matching action. Runs after the response; failures are logged.
 */
function unlockForExistingPlayers(achievement: AchievementDoc): void {
  void (async () => {
    const eligible =
      achievement.criteria.kind === 'level'
        ? await User.find({ level: { $gte: achievement.criteria.level } }).select('_id').lean()
        : (await UserCounter.find({ event: achievement.criteria.event, count: { $gte: achievement.criteria.count } }).select('userId').lean()).map(
            (row) => ({ _id: row.userId }),
          );
    for (const player of eligible) await unlock(String(player._id), achievement);
    if (eligible.length > 0) logger.info({ achievement: achievement.code, players: eligible.length }, 'Achievement unlocked for existing players');
  })().catch((error: unknown) => logger.error({ err: error, achievement: achievement.code }, 'Achievement backfill failed'));
}

export async function adminCreateAchievement(input: AchievementInput): Promise<AdminAchievement> {
  const last = await Achievement.findOne().sort({ order: -1 }).select('order').lean<Pick<AchievementDoc, 'order'>>();
  const doc = (await Achievement.create({ ...input, code: codeFor('ach', input.title), order: (last?.order ?? 0) + 1 })).toObject();
  unlockForExistingPlayers(doc);
  const [created] = await toAdminAchievements([doc]);
  return created!;
}

export async function adminUpdateAchievement(id: string, input: AchievementInput): Promise<AdminAchievement> {
  const doc = await Achievement.findByIdAndUpdate(toObjectId(id), { $set: input }, { returnDocument: 'after' }).lean<AchievementDoc>();
  if (!doc) throw AppError.notFound('Achievement');
  // An easier requirement can make more players eligible; nobody loses one they already have.
  unlockForExistingPlayers(doc);
  const [updated] = await toAdminAchievements([doc]);
  return updated!;
}

/** Players lose the achievement (and a title it gave, from what they can wear); XP it awarded stays. */
export async function adminDeleteAchievement(id: string): Promise<void> {
  const result = await Achievement.deleteOne({ _id: toObjectId(id) });
  if (result.deletedCount === 0) throw AppError.notFound('Achievement');
  await UserAchievement.deleteMany({ achievementId: toObjectId(id) });
}

/* ───────────── Seasons & Pulse ───────────── */

const percentOf = (threshold: number, goal: number) => Math.round((threshold / goal) * 100);

async function toAdminSeasons(pulses: PulseDoc[], now = new Date()): Promise<AdminSeason[]> {
  const contributors = await SeasonStat.aggregate<{ _id: string; n: number }>([
    { $match: { seasonKey: { $in: pulses.map((pulse) => pulse.key) }, xp: { $gt: 0 } } },
    { $group: { _id: '$seasonKey', n: { $sum: 1 } } },
  ]);
  const byKey = new Map(contributors.map((row) => [row._id, row.n]));
  return pulses.map((pulse) => ({
    key: pulse.key,
    title: pulse.title,
    description: pulse.description,
    goal: pulse.goal,
    current: pulse.current,
    startsAt: pulse.startsAt.toISOString(),
    endsAt: pulse.endsAt.toISOString(),
    milestones: pulse.milestones.map((m) => ({ percent: percentOf(m.threshold, pulse.goal), reward: m.reward, reached: pulse.current >= m.threshold })),
    contributors: byKey.get(pulse.key) ?? 0,
    status: pulse.startsAt > now ? 'upcoming' : pulse.endsAt < now ? 'ended' : 'active',
  }));
}

export async function adminListSeasons(): Promise<AdminSeason[]> {
  return toAdminSeasons(await Pulse.find().sort({ startsAt: -1 }).lean<PulseDoc[]>());
}

function pulseFields(input: SeasonInput) {
  return {
    title: input.title,
    description: input.description,
    goal: input.goal,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    milestones: [...input.milestones]
      .sort((a, b) => a.percent - b.percent)
      .map((m) => ({ threshold: Math.round((input.goal * m.percent) / 100), label: `${m.percent}%`, reward: m.reward })),
  };
}

/** Two seasons can't run at once: every XP award belongs to exactly one. */
async function assertNoOverlap(input: SeasonInput, exceptKey?: string): Promise<void> {
  const clash = await Pulse.findOne({
    ...(exceptKey ? { key: { $ne: exceptKey } } : {}),
    startsAt: { $lt: input.endsAt },
    endsAt: { $gt: input.startsAt },
  })
    .select('title')
    .lean<Pick<PulseDoc, 'title'>>();
  if (clash) throw AppError.unprocessable(`Overlaps ${clash.title}`, { fields: { startsAt: `Overlaps ${clash.title}` } });
}

export async function adminCreateSeason(input: SeasonInput): Promise<AdminSeason> {
  await assertNoOverlap(input);
  const count = await Pulse.estimatedDocumentCount();
  let key = `season-${count + 1}`;
  while (await Pulse.exists({ key })) key = `${key}-${randomBytes(1).toString('hex')}`;
  const doc = (await Pulse.create({ key, current: 0, ...pulseFields(input) })).toObject();
  const [created] = await toAdminSeasons([doc]);
  return created!;
}

/** Edits keep the XP already gathered; a milestone already passed won't be announced again. */
export async function adminUpdateSeason(key: string, input: SeasonInput): Promise<AdminSeason> {
  await assertNoOverlap(input, key);
  const doc = await Pulse.findOneAndUpdate({ key }, { $set: pulseFields(input) }, { returnDocument: 'after' }).lean<PulseDoc>();
  if (!doc) throw AppError.notFound('Season');
  const [updated] = await toAdminSeasons([doc]);
  return updated!;
}

/* ───────────── XP adjustments ───────────── */

/**
 * Takes XP back from a player: never below zero, levels follow the new total,
 * and their season score drops with it. The community Pulse keeps what it
 * reached, so milestones already announced stay unlocked.
 */
async function removeXp(user: Pick<UserDoc, '_id' | 'xp'>, amount: number, reason: string, adminId: string): Promise<number> {
  const taken = Math.min(amount, user.xp);
  if (taken <= 0) throw AppError.unprocessable('This player has no XP to remove', { fields: { amount: 'This player has no XP to remove' } });
  const season = await activePulse();
  await XpLedger.create({
    userId: user._id,
    amount: -taken,
    reason,
    idempotencyKey: `admin-remove:${new Types.ObjectId().toHexString()}`,
    seasonKey: season?.key ?? null,
    grantedBy: toObjectId(adminId),
  });
  const updated = await User.findOneAndUpdate({ _id: user._id }, { $inc: { xp: -taken } }, { returnDocument: 'after', projection: { xp: 1 } }).lean<Pick<UserDoc, 'xp'>>();
  // A concurrent award may have landed in between; level always follows the stored total.
  await User.updateOne({ _id: user._id }, { $set: { xp: Math.max(0, updated?.xp ?? 0), level: levelFromXp(Math.max(0, updated?.xp ?? 0)).level } });
  if (season) {
    const stat = await SeasonStat.findOne({ seasonKey: season.key, userId: user._id }).lean();
    if (stat && stat.xp > 0) await SeasonStat.updateOne({ _id: stat._id }, { $inc: { xp: -Math.min(taken, stat.xp) } });
  }
  return taken;
}

export async function adminAdjustXp(input: XpAdjustInput, adminId: string): Promise<AdminXpAdjustment> {
  const user = await User.findOne({ usernameLower: input.username.toLowerCase() }).select('_id xp username').lean<Pick<UserDoc, '_id' | 'xp' | 'username'>>();
  if (!user) throw AppError.unprocessable('No player with that username', { fields: { username: 'No player with that username' } });

  if (input.amount > 0) {
    const key = `admin-grant:${new Types.ObjectId().toHexString()}`;
    await awardXp(String(user._id), input.amount, `From the TG Hub team · ${input.reason}`, key, adminId);
  } else {
    await removeXp(user, -input.amount, `Removed by the TG Hub team · ${input.reason}`, adminId);
  }
  const [latest] = await adminListXpAdjustments(1, String(user._id));
  return latest!;
}

/** The admin log of manual adjustments, newest first. */
export async function adminListXpAdjustments(limit = 30, userId?: string): Promise<AdminXpAdjustment[]> {
  const rows = await XpLedger.find({ grantedBy: { $ne: null }, ...(userId ? { userId: toObjectId(userId) } : {}) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const people = await User.find({ _id: { $in: rows.flatMap((row) => [row.userId, row.grantedBy!]) } })
    .select('username displayName')
    .lean<Array<Pick<UserDoc, '_id' | 'username' | 'displayName'>>>();
  const byId = new Map(people.map((person) => [String(person._id), person]));
  return rows.map((row) => {
    const player = byId.get(String(row.userId));
    return {
      id: String(row._id),
      player: { id: String(row.userId), username: player?.username ?? 'deleted', displayName: player?.displayName ?? 'Deleted player' },
      amount: row.amount,
      reason: row.reason.replace(/^(From|Removed by) the TG Hub team · /, ''),
      by: byId.get(String(row.grantedBy))?.displayName ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  });
}
