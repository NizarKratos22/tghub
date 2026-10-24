import { model, Schema, type Types } from 'mongoose';
import { CLAN_COLORS, CLAN_JOIN_POLICIES, CLAN_ROLES, LFG_LANGUAGES, PLATFORMS, type ClanJoinPolicy, type ClanRole, type CountryCode, type LfgLanguage, type Platform } from '@tgh/shared';

/* ───────────── Clans ───────────── */

/**
 * A player-run team. `xp` and `seasonXp` are the members' combined XP, kept
 * current as XP is awarded and recomputed by a job (season rollovers,
 * members leaving).
 */
export interface ClanDoc {
  _id: Types.ObjectId;
  tag: string;
  name: string;
  nameLower: string;
  color: string;
  description: string;
  joinPolicy: ClanJoinPolicy;
  country: CountryCode | null;
  gameIds: Types.ObjectId[];
  ownerId: Types.ObjectId;
  memberCount: number;
  xp: number;
  seasonXp: number;
  seasonKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const clanSchema = new Schema<ClanDoc>(
  {
    tag: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    nameLower: { type: String, required: true },
    color: { type: String, enum: CLAN_COLORS, default: CLAN_COLORS[0] },
    description: { type: String, default: '' },
    joinPolicy: { type: String, enum: CLAN_JOIN_POLICIES, default: 'request' },
    country: { type: String, default: null },
    gameIds: { type: [Schema.Types.ObjectId], default: [] },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    memberCount: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    seasonXp: { type: Number, default: 0 },
    seasonKey: { type: String, default: null },
  },
  { timestamps: true },
);

clanSchema.index({ seasonXp: -1, xp: -1 });
clanSchema.index({ xp: -1 });
clanSchema.index({ memberCount: -1 });
clanSchema.index({ gameIds: 1 });

export const Clan = model<ClanDoc>('Clan', clanSchema);

/** One clan per player: the unique userId enforces it even under races. */
export interface ClanMemberDoc {
  _id: Types.ObjectId;
  clanId: Types.ObjectId;
  userId: Types.ObjectId;
  role: ClanRole;
  joinedAt: Date;
}

const clanMemberSchema = new Schema<ClanMemberDoc>({
  clanId: { type: Schema.Types.ObjectId, ref: 'Clan', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  role: { type: String, enum: CLAN_ROLES, required: true },
  joinedAt: { type: Date, default: () => new Date() },
});

clanMemberSchema.index({ clanId: 1, role: 1 });

export const ClanMember = model<ClanMemberDoc>('ClanMember', clanMemberSchema, 'clan_members');

/** An application. Declined ones are kept for a day so players can't re-apply in a loop. */
export interface ClanRequestDoc {
  _id: Types.ObjectId;
  clanId: Types.ObjectId;
  userId: Types.ObjectId;
  message: string;
  status: 'pending' | 'declined';
  decidedAt: Date | null;
  createdAt: Date;
}

const clanRequestSchema = new Schema<ClanRequestDoc>(
  {
    clanId: { type: Schema.Types.ObjectId, ref: 'Clan', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'declined'], default: 'pending' },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

clanRequestSchema.index({ clanId: 1, userId: 1 }, { unique: true });
clanRequestSchema.index({ clanId: 1, status: 1, createdAt: -1 });
clanRequestSchema.index({ userId: 1, status: 1 });

export const ClanRequest = model<ClanRequestDoc>('ClanRequest', clanRequestSchema, 'clan_requests');

/* ───────────── Teammate finder ───────────── */

export type LfgStatus = 'open' | 'full' | 'closed';

export interface LfgPostDoc {
  _id: Types.ObjectId;
  authorId: Types.ObjectId;
  gameId: Types.ObjectId;
  platform: Platform;
  mode: string;
  rank: string;
  slots: number;
  filled: number;
  languages: LfgLanguage[];
  micRequired: boolean;
  note: string;
  /** Revealed only to the author and accepted players. */
  contact: string;
  country: CountryCode | null;
  status: LfgStatus;
  expiresAt: Date;
  /** Expired posts linger a week (for notification links), then MongoDB removes them. */
  purgeAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const lfgPostSchema = new Schema<LfgPostDoc>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true },
    platform: { type: String, enum: PLATFORMS, required: true },
    mode: { type: String, required: true },
    rank: { type: String, default: '' },
    slots: { type: Number, required: true },
    filled: { type: Number, default: 0 },
    languages: { type: [String], enum: LFG_LANGUAGES, default: [] },
    micRequired: { type: Boolean, default: false },
    note: { type: String, default: '' },
    contact: { type: String, required: true },
    country: { type: String, default: null },
    status: { type: String, enum: ['open', 'full', 'closed'], default: 'open' },
    expiresAt: { type: Date, required: true },
    purgeAt: { type: Date, required: true },
  },
  { timestamps: true },
);

lfgPostSchema.index({ status: 1, expiresAt: 1, createdAt: -1 });
lfgPostSchema.index({ gameId: 1, status: 1, createdAt: -1 });
lfgPostSchema.index({ authorId: 1, createdAt: -1 });
lfgPostSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

export const LfgPost = model<LfgPostDoc>('LfgPost', lfgPostSchema, 'lfg_posts');

export interface LfgRequestDoc {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  userId: Types.ObjectId;
  message: string;
  contact: string;
  status: 'pending' | 'accepted' | 'declined';
  decidedAt: Date | null;
  purgeAt: Date;
  createdAt: Date;
}

const lfgRequestSchema = new Schema<LfgRequestDoc>(
  {
    postId: { type: Schema.Types.ObjectId, ref: 'LfgPost', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, default: '' },
    contact: { type: String, required: true },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
    decidedAt: { type: Date, default: null },
    purgeAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

lfgRequestSchema.index({ postId: 1, userId: 1 }, { unique: true });
lfgRequestSchema.index({ postId: 1, status: 1, createdAt: 1 });
lfgRequestSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

export const LfgRequest = model<LfgRequestDoc>('LfgRequest', lfgRequestSchema, 'lfg_requests');
