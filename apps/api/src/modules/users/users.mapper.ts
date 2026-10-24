import { titleForLevel, type AdminUser, type CountryCode, type PlayerRef, type UserPublic } from '@tgh/shared';
import { mediaUrl, type MediaVariant } from '../media/media.service';
import type { UserDoc } from './user.model';

type PublicSource = Pick<
  UserDoc,
  '_id' | 'username' | 'displayName' | 'avatarColor' | 'bio' | 'country' | 'region' | 'level' | 'xp' | 'equippedTitle' | 'createdAt'
> &
  Partial<Pick<UserDoc, 'avatarMediaId' | 'bannerMediaId'>>;

/**
 * The uploaded avatar, if any — every user reference in the API carries it.
 * Lists get the 128px thumbnail; the player's own profile gets the 512px file.
 */
export function avatarUrlOf(user: Partial<Pick<UserDoc, 'avatarMediaId'>>, variant: MediaVariant = 'thumb'): string | null {
  return user.avatarMediaId ? mediaUrl(user.avatarMediaId, variant) : null;
}

/** Fields to select wherever a user is shown with their avatar. */
export const USER_REF_FIELDS = 'username displayName avatarColor avatarMediaId';

export type PlayerRefSource = Pick<UserDoc, '_id' | 'username' | 'displayName' | 'avatarColor'> & Partial<Pick<UserDoc, 'avatarMediaId'>>;

export function toPlayerRef(user: PlayerRefSource): PlayerRef {
  return {
    id: String(user._id),
    username: user.username,
    displayName: user.displayName,
    avatarColor: user.avatarColor,
    avatarUrl: avatarUrlOf(user),
  };
}

/** Accounts from before countries existed only had a governorate. */
export function countryOf(user: Partial<Pick<UserDoc, 'country' | 'region'>>): CountryCode | null {
  return user.country ?? (user.region && user.region !== 'Abroad' ? 'TN' : null);
}

export function toUserPublic(user: PublicSource): UserPublic {
  return {
    id: String(user._id),
    username: user.username,
    displayName: user.displayName,
    avatarColor: user.avatarColor,
    avatarUrl: avatarUrlOf(user, 'full'),
    bannerUrl: user.bannerMediaId ? mediaUrl(user.bannerMediaId, 'full') : null,
    bio: user.bio,
    country: countryOf(user),
    region: user.region,
    level: user.level,
    xp: user.xp,
    title: user.equippedTitle ?? titleForLevel(user.level),
    createdAt: user.createdAt.toISOString(),
  };
}

export function toAdminUser(user: UserDoc): AdminUser {
  return {
    id: String(user._id),
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
    level: user.level,
    xp: user.xp,
    country: countryOf(user),
    region: user.region,
    displayName: user.displayName,
    avatarColor: user.avatarColor,
    avatarUrl: avatarUrlOf(user),
    hasBanner: Boolean(user.bannerMediaId),
    sellerVerified: user.sellerVerified === true,
    sellerOverride: user.sellerOverride ?? 'auto',
    createdAt: user.createdAt.toISOString(),
  };
}
