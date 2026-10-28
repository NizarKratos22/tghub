import { model, Schema, type Types } from 'mongoose';
import { AVATAR_COLORS, ROLES, USER_STATUSES, type CountryCode, type Role, type TnRegion, type UserStatus } from '@tgh/shared';

export interface UserDoc {
  _id: Types.ObjectId;
  email: string;
  /**
   * null = waiting for the emailed code. Accounts created before verification
   * existed have no field at all and count as verified.
   */
  emailVerifiedAt?: Date | null;
  username: string;
  usernameLower: string;
  displayName: string;
  passwordHash: string;
  role: Role;
  status: UserStatus;
  bio: string;
  /** ISO 3166-1 alpha-2. */
  country: CountryCode | null;
  /** Governorate; only set when country is TN. */
  region: TnRegion | null;
  avatarColor: string;
  /** Uploaded profile picture / banner (Media ids); the monogram shows without one. */
  avatarMediaId?: Types.ObjectId | null;
  bannerMediaId?: Types.ObjectId | null;
  /** Off = level-ups, listings and clan moves stay out of followers' feeds. Missing means on. */
  shareActivity?: boolean;
  /** Shown on the public profile; normalised by discordUsernameSchema. Missing means not shared. */
  discordUsername?: string | null;
  /** False for accounts created through Discord until the player sets a password. Missing means set. */
  passwordSet?: boolean;
  /** Verified seller badge, recomputed from sales and ratings; a moderator can pin it either way. */
  sellerVerified?: boolean;
  sellerOverride?: 'auto' | 'verified' | 'revoked';
  followerCount?: number;
  followingCount?: number;
  equippedTitle: string | null;
  /** Cached from xp_ledger — the ledger is the source of truth. */
  xp: number;
  level: number;
  /** Tunis-local day of the last session activity, for the daily check-in. */
  lastActiveDay: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // No default on purpose: see the interface note.
    emailVerifiedAt: { type: Date },
    username: { type: String, required: true, trim: true },
    usernameLower: { type: String, required: true, unique: true },
    displayName: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'user' },
    status: { type: String, enum: USER_STATUSES, default: 'active' },
    bio: { type: String, default: '' },
    country: { type: String, default: null },
    region: { type: String, default: null },
    avatarColor: { type: String, default: AVATAR_COLORS[0] },
    avatarMediaId: { type: Schema.Types.ObjectId, default: null },
    bannerMediaId: { type: Schema.Types.ObjectId, default: null },
    shareActivity: { type: Boolean, default: true },
    discordUsername: { type: String, default: null },
    passwordSet: { type: Boolean, default: true },
    sellerVerified: { type: Boolean, default: false },
    sellerOverride: { type: String, enum: ['auto', 'verified', 'revoked'], default: 'auto' },
    followerCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    equippedTitle: { type: String, default: null },
    xp: { type: Number, default: 0, min: 0 },
    level: { type: Number, default: 1, min: 1 },
    lastActiveDay: { type: String, default: null },
  },
  { timestamps: true },
);

userSchema.index({ region: 1 });
userSchema.index({ country: 1 });
userSchema.index({ createdAt: -1 });

export const User = model<UserDoc>('User', userSchema);
