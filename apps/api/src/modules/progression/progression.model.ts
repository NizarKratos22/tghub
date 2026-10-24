import { model, Schema, type Types } from 'mongoose';
import { MISSION_CADENCES, TRACKABLE_EVENTS, type MissionCadence, type TrackableEvent } from '@tgh/shared';

/* ── XP ledger: append-only, idempotent. The truth behind every XP number. ── */

export interface XpLedgerDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  amount: number;
  reason: string;
  /** e.g. "mission:<id>:2026-10-24" — the unique index makes awards exactly-once. */
  idempotencyKey: string;
  seasonKey: string | null;
  createdAt: Date;
}

const xpLedgerSchema = new Schema<XpLedgerDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true },
    idempotencyKey: { type: String, required: true, unique: true },
    seasonKey: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
xpLedgerSchema.index({ userId: 1, createdAt: -1 });
xpLedgerSchema.index({ createdAt: -1 });

export const XpLedger = model<XpLedgerDoc>('XpLedger', xpLedgerSchema, 'xp_ledger');

/* ── Season standings, kept incrementally for cheap leaderboards. ── */

export interface SeasonStatDoc {
  _id: Types.ObjectId;
  seasonKey: string;
  userId: Types.ObjectId;
  xp: number;
}

const seasonStatSchema = new Schema<SeasonStatDoc>({
  seasonKey: { type: String, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  xp: { type: Number, default: 0 },
});
seasonStatSchema.index({ seasonKey: 1, userId: 1 }, { unique: true });
seasonStatSchema.index({ seasonKey: 1, xp: -1 });

export const SeasonStat = model<SeasonStatDoc>('SeasonStat', seasonStatSchema, 'season_stats');

/* ── Per-user event counters feed achievements ("check 10 rigs"). ── */

export interface UserCounterDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  event: TrackableEvent;
  count: number;
}

const userCounterSchema = new Schema<UserCounterDoc>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  event: { type: String, enum: TRACKABLE_EVENTS, required: true },
  count: { type: Number, default: 0 },
});
userCounterSchema.index({ userId: 1, event: 1 }, { unique: true });

export const UserCounter = model<UserCounterDoc>('UserCounter', userCounterSchema, 'user_counters');

/* ── Missions ── */

export interface MissionDoc {
  _id: Types.ObjectId;
  code: string;
  title: string;
  description: string;
  cadence: MissionCadence;
  event: TrackableEvent;
  target: number;
  xpReward: number;
  active: boolean;
  /** Special missions only. */
  startsAt: Date | null;
  endsAt: Date | null;
  order: number;
}

const missionSchema = new Schema<MissionDoc>({
  code: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  cadence: { type: String, enum: MISSION_CADENCES, required: true },
  event: { type: String, enum: TRACKABLE_EVENTS, required: true },
  target: { type: Number, required: true, min: 1 },
  xpReward: { type: Number, required: true, min: 0 },
  active: { type: Boolean, default: true },
  startsAt: { type: Date, default: null },
  endsAt: { type: Date, default: null },
  order: { type: Number, default: 0 },
});
missionSchema.index({ active: 1, event: 1 });

export const Mission = model<MissionDoc>('Mission', missionSchema);

export interface MissionProgressDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  missionId: Types.ObjectId;
  /** "2026-10-24", "2026-W43" or "special". */
  periodKey: string;
  progress: number;
  completedAt: Date | null;
  claimedAt: Date | null;
}

const missionProgressSchema = new Schema<MissionProgressDoc>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  missionId: { type: Schema.Types.ObjectId, ref: 'Mission', required: true },
  periodKey: { type: String, required: true },
  progress: { type: Number, default: 0 },
  completedAt: { type: Date, default: null },
  claimedAt: { type: Date, default: null },
});
missionProgressSchema.index({ userId: 1, missionId: 1, periodKey: 1 }, { unique: true });

export const MissionProgress = model<MissionProgressDoc>('MissionProgress', missionProgressSchema, 'mission_progress');

/* ── Achievements ── */

export type AchievementCriteria =
  | { kind: 'event_count'; event: TrackableEvent; count: number }
  | { kind: 'level'; level: number };

export interface AchievementDoc {
  _id: Types.ObjectId;
  code: string;
  title: string;
  description: string;
  criteria: AchievementCriteria;
  xpReward: number;
  cosmetic: { kind: 'title' | 'badge'; value: string } | null;
  order: number;
}

const achievementSchema = new Schema<AchievementDoc>({
  code: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  criteria: {
    kind: { type: String, enum: ['event_count', 'level'], required: true },
    event: { type: String, enum: TRACKABLE_EVENTS },
    count: { type: Number },
    level: { type: Number },
  },
  xpReward: { type: Number, default: 0 },
  cosmetic: {
    type: new Schema({ kind: { type: String, enum: ['title', 'badge'] }, value: String }, { _id: false }),
    default: null,
  },
  order: { type: Number, default: 0 },
});
achievementSchema.index({ 'criteria.kind': 1, 'criteria.event': 1 });

export const Achievement = model<AchievementDoc>('Achievement', achievementSchema);

export interface UserAchievementDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  achievementId: Types.ObjectId;
  unlockedAt: Date;
}

const userAchievementSchema = new Schema<UserAchievementDoc>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  achievementId: { type: Schema.Types.ObjectId, ref: 'Achievement', required: true },
  unlockedAt: { type: Date, default: () => new Date() },
});
userAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });
userAchievementSchema.index({ achievementId: 1 });

export const UserAchievement = model<UserAchievementDoc>('UserAchievement', userAchievementSchema, 'user_achievements');

/* ── The Pulse: one shared meter per season, fed by every XP award. ── */

export interface PulseDoc {
  _id: Types.ObjectId;
  key: string;
  title: string;
  description: string;
  goal: number;
  current: number;
  startsAt: Date;
  endsAt: Date;
  milestones: Array<{ threshold: number; label: string; reward: string }>;
}

const pulseSchema = new Schema<PulseDoc>({
  key: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  goal: { type: Number, required: true, min: 1 },
  current: { type: Number, default: 0 },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  milestones: [{ threshold: Number, label: String, reward: String, _id: false }],
});
pulseSchema.index({ startsAt: 1, endsAt: 1 });

export const Pulse = model<PulseDoc>('Pulse', pulseSchema);
