import type { ClanSummary, CountryCode, GameRef, LfgPost as LfgPostDto, LfgRequest as LfgRequestDto, PlayerRef } from '@tgh/shared';
import type { UserDoc } from '../users/user.model';
import { countryOf, toPlayerRef, USER_REF_FIELDS } from '../users/users.mapper';
import type { ClanDoc, LfgPostDoc, LfgRequestDoc } from './squads.model';

/** User fields for player cards in squads: avatar, level and home. */
export const PLAYER_FIELDS = `${USER_REF_FIELDS} level country region`;

export type PlayerSource = Pick<UserDoc, '_id' | 'username' | 'displayName' | 'avatarColor' | 'level' | 'country' | 'region'> &
  Partial<Pick<UserDoc, 'avatarMediaId'>>;

export type SquadPlayer = PlayerRef & { level: number; country: CountryCode | null };

export function toSquadPlayer(user: PlayerSource): SquadPlayer {
  return { ...toPlayerRef(user), level: user.level, country: countryOf(user) };
}

export const GONE_PLAYER: SquadPlayer = {
  id: '',
  username: '',
  displayName: 'Former member',
  avatarColor: '#62686d',
  avatarUrl: null,
  level: 1,
  country: null,
};

export function toClanSummary(doc: ClanDoc, games: Map<string, GameRef>): ClanSummary {
  return {
    id: String(doc._id),
    tag: doc.tag,
    name: doc.name,
    color: doc.color,
    description: doc.description,
    joinPolicy: doc.joinPolicy,
    country: doc.country,
    games: doc.gameIds.flatMap((id) => games.get(String(id)) ?? []),
    memberCount: doc.memberCount,
    xp: doc.xp,
    seasonXp: doc.seasonXp,
    createdAt: doc.createdAt.toISOString(),
  };
}

/** A post past its expiry reads as closed, whatever its stored status. */
export function lfgStatusOf(doc: Pick<LfgPostDoc, 'status' | 'expiresAt'>, now = new Date()): LfgPostDto['status'] {
  return doc.status === 'open' && doc.expiresAt <= now ? 'closed' : doc.status;
}

export function toLfgPost(
  doc: LfgPostDoc,
  context: {
    game: GameRef;
    author: SquadPlayer & { clanTag: string | null };
    viewerId: string | null;
    viewerRequest: LfgRequestDoc['status'] | null;
    pendingRequests: number;
  },
): LfgPostDto {
  const isAuthor = context.viewerId === String(doc.authorId);
  return {
    id: String(doc._id),
    game: context.game,
    platform: doc.platform,
    mode: doc.mode,
    rank: doc.rank,
    slots: doc.slots,
    filled: doc.filled,
    languages: doc.languages,
    micRequired: doc.micRequired,
    note: doc.note,
    author: context.author,
    status: lfgStatusOf(doc),
    expiresAt: doc.expiresAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    viewer: { isAuthor, request: context.viewerRequest },
    contact: isAuthor || context.viewerRequest === 'accepted' ? doc.contact : null,
    pendingRequests: isAuthor ? context.pendingRequests : 0,
  };
}

export function toLfgRequest(doc: LfgRequestDoc, user: SquadPlayer): LfgRequestDto {
  return {
    id: String(doc._id),
    user,
    message: doc.message,
    contact: doc.contact,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
  };
}
