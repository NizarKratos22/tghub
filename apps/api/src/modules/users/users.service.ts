import type { QueryFilter } from 'mongoose';
import type { AdminUser, Me, Page, PublicProfile, Role, UpdateProfileInput, UserStatus } from '@tgh/shared';
import { AppError } from '../../core/http/errors';
import { escapeRegex, paginate, skipFor } from '../../core/http/utils';
import { unreadCount } from '../alerts/inbox.service';
import { marketUnreadCount } from '../market/conversations.service';
import { Session } from '../auth/session.model';
import { favoriteGames } from '../library/library.service';
import { attachMedia, detachMedia, storeImage } from '../media/media.service';
import { availableTitles, snapshot, unlockedAchievements } from '../progression/progression.service';
import { publicConnections } from '../connections/connections.service';
import { reputationFor } from '../market/reputation.service';
import { clanBadgeFor } from '../squads/clans.service';
import { User, type UserDoc } from './user.model';
import { toAdminUser, toUserPublic } from './users.mapper';

export async function getMe(userId: string): Promise<Me> {
  const user = await User.findById(userId).lean<UserDoc>();
  if (!user || user.status !== 'active') throw AppError.unauthorized();
  const [unread, marketUnread, titles] = await Promise.all([unreadCount(userId), marketUnreadCount(userId), availableTitles(userId, user.level)]);
  return {
    ...toUserPublic(user),
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    role: user.role,
    unreadCount: unread,
    marketUnread,
    availableTitles: titles,
    shareActivity: user.shareActivity !== false,
  };
}

export async function updateProfile(userId: string, input: UpdateProfileInput): Promise<Me> {
  const set: UpdateProfileInput = { ...input };
  // Keep country and governorate consistent whichever one changed.
  if (set.region) set.country = 'TN';
  if (set.country !== undefined && set.country !== 'TN') set.region = null;
  await User.updateOne({ _id: userId }, { $set: set });
  return getMe(userId);
}

export async function equipTitle(userId: string, title: string | null): Promise<Me> {
  if (title !== null) {
    const user = await User.findById(userId).select('level').lean<Pick<UserDoc, 'level'>>();
    if (!user) throw AppError.unauthorized();
    const titles = await availableTitles(userId, user.level);
    if (!titles.includes(title)) throw AppError.forbidden("You haven't unlocked that title yet");
  }
  await User.updateOne({ _id: userId }, { $set: { equippedTitle: title } });
  return getMe(userId);
}

export type ProfileImage = 'avatar' | 'banner';
const IMAGE_FIELD = { avatar: 'avatarMediaId', banner: 'bannerMediaId' } as const satisfies Record<ProfileImage, keyof UserDoc>;

/** Points the profile at a freshly processed upload; the previous file is left for the orphan cleanup. */
export async function setProfileImage(userId: string, kind: ProfileImage, file: Buffer): Promise<Me> {
  const image = await storeImage(userId, kind, file);
  const field = IMAGE_FIELD[kind];
  const before = await User.findOneAndUpdate({ _id: userId }, { $set: { [field]: image.id } }).select(field).lean<UserDoc>();
  await attachMedia([image.id], userId);
  const previous = before?.[field];
  if (previous) await detachMedia([previous]);
  return getMe(userId);
}

export async function clearProfileImage(userId: string, kind: ProfileImage): Promise<Me> {
  const field = IMAGE_FIELD[kind];
  const before = await User.findOneAndUpdate({ _id: userId }, { $set: { [field]: null } }).select(field).lean<UserDoc>();
  const previous = before?.[field];
  if (previous) await detachMedia([previous]);
  return getMe(userId);
}

export async function getPublicProfile(username: string): Promise<PublicProfile> {
  const user = await User.findOne({ usernameLower: username.toLowerCase(), status: 'active' }).lean<UserDoc>();
  if (!user) throw AppError.notFound('Player');
  const userId = String(user._id);
  const [progress, achievements, favorites, clan, connections, reputation] = await Promise.all([
    snapshot(userId),
    unlockedAchievements(userId),
    favoriteGames(userId, 8),
    clanBadgeFor(userId),
    publicConnections(userId),
    reputationFor(user._id),
  ]);
  return {
    user: toUserPublic(user),
    reputation,
    clan,
    followers: user.followerCount ?? 0,
    following: user.followingCount ?? 0,
    ...connections,
    seasonRank: progress.seasonRank,
    seasonXp: progress.seasonXp,
    achievements,
    favoriteGames: favorites,
  };
}

/* ───────────── Admin ───────────── */

export async function adminListUsers(query: { q?: string; page: number; pageSize: number }): Promise<Page<AdminUser>> {
  const filter: QueryFilter<UserDoc> = {};
  if (query.q) {
    const term = escapeRegex(query.q.toLowerCase());
    filter.$or = [{ usernameLower: { $regex: term } }, { email: { $regex: term } }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skipFor(query.page, query.pageSize)).limit(query.pageSize).lean<UserDoc[]>(),
    User.countDocuments(filter),
  ]);
  return paginate(users.map(toAdminUser), total, query.page, query.pageSize);
}

/** Moderation: takes down a player's avatar and banner (the monogram shows again). */
export async function adminClearProfileImages(userId: string): Promise<AdminUser> {
  const before = await User.findOneAndUpdate({ _id: userId }, { $set: { avatarMediaId: null, bannerMediaId: null } }).lean<UserDoc>();
  if (!before) throw AppError.notFound('Player');
  await detachMedia([before.avatarMediaId, before.bannerMediaId].filter((id) => id != null));
  return toAdminUser({ ...before, avatarMediaId: null, bannerMediaId: null });
}

export async function adminUpdateUser(
  actorId: string,
  userId: string,
  input: { role?: Role; status?: UserStatus },
): Promise<AdminUser> {
  const demotesSelf = (input.role !== undefined && input.role !== 'admin') || input.status === 'banned';
  if (actorId === userId && demotesSelf) {
    throw AppError.forbidden("You can't demote or suspend your own account");
  }
  const user = await User.findByIdAndUpdate(userId, { $set: input }, { returnDocument: 'after' }).lean<UserDoc>();
  if (!user) throw AppError.notFound('Player');
  // Suspension takes effect immediately: refresh tokens die, access tokens expire within minutes.
  if (input.status === 'banned') await Session.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
  return toAdminUser(user);
}
