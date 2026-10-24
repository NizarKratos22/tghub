import { randomBytes } from 'node:crypto';
import { AVATAR_COLORS, type AuthProviders, type Connections, type PublicProfile } from '@tgh/shared';
import { env } from '../../config/env';
import { hashPassword } from '../../core/auth/password';
import { bus } from '../../core/events/bus';
import { AppError, isDuplicateKeyError } from '../../core/http/errors';
import { logger } from '../../core/logger';
import { startSession, type ClientMeta, type IssuedSession } from '../auth/auth.service';
import { Game, type GameDoc } from '../games/game.model';
import { gameRefMap } from '../games/games.service';
import { User, type UserDoc } from '../users/user.model';
import { setProfileImage } from '../users/users.service';
import { Connection, type ConnectionDoc, type ConnectionProvider } from './connections.model';
import { discordEnabled, steamOwnedGames, steamProfileUrl, steamSummary, type DiscordProfile } from './providers';

/** Steam library refreshes at most this often per player. */
const STEAM_SYNC_COOLDOWN_MS = 10 * 60 * 1000;

export function authProviders(): AuthProviders {
  return { discord: discordEnabled(), steam: true };
}

export async function listConnections(userId: string): Promise<Connections> {
  const [rows, user] = await Promise.all([
    Connection.find({ userId }).lean<ConnectionDoc[]>(),
    User.findById(userId).select('passwordSet').lean<Pick<UserDoc, 'passwordSet'>>(),
  ]);
  const discord = rows.find((row) => row.provider === 'discord');
  const steam = rows.find((row) => row.provider === 'steam');

  let steamGames: NonNullable<Connections['steam']>['games'] = [];
  if (steam && steam.games.length > 0) {
    const catalogue = await Game.find({ steamAppId: { $in: steam.games.map((g) => g.appId) } }).select('_id steamAppId').lean<Array<Pick<GameDoc, '_id' | 'steamAppId'>>>();
    const refs = await gameRefMap(catalogue.map((game) => game._id));
    const minutesByApp = new Map(steam.games.map((g) => [g.appId, g.minutes]));
    steamGames = catalogue
      .flatMap((game) => {
        const ref = refs.get(String(game._id));
        return ref ? [{ game: ref, hours: Math.round((minutesByApp.get(game.steamAppId!) ?? 0) / 6) / 10 }] : [];
      })
      .sort((a, b) => b.hours - a.hours);
  }

  return {
    discord: discord ? { id: discord.externalId, username: discord.username ?? 'Discord user', avatarUrl: discord.avatarUrl, connectedAt: discord.createdAt.toISOString() } : null,
    steam: steam
      ? {
          id: steam.externalId,
          personaName: steam.username,
          profileUrl: steam.profileUrl ?? steamProfileUrl(steam.externalId),
          avatarUrl: steam.avatarUrl,
          games: steamGames,
          gamesSyncedAt: steam.gamesSyncedAt?.toISOString() ?? null,
          connectedAt: steam.createdAt.toISOString(),
        }
      : null,
    canUnlinkDiscord: user?.passwordSet !== false,
    steamGamesAvailable: Boolean(env.STEAM_API_KEY),
  };
}

/** What a public profile shows about linked accounts. */
export async function publicConnections(userId: string): Promise<Pick<PublicProfile, 'steam' | 'discordLinked'>> {
  const rows = await Connection.find({ userId }).select('provider externalId username profileUrl').lean<ConnectionDoc[]>();
  const steam = rows.find((row) => row.provider === 'steam');
  return {
    steam: steam ? { profileUrl: steam.profileUrl ?? steamProfileUrl(steam.externalId), personaName: steam.username } : null,
    discordLinked: rows.some((row) => row.provider === 'discord'),
  };
}

async function link(userId: string, provider: ConnectionProvider, externalId: string, fields: Partial<ConnectionDoc>): Promise<void> {
  const owner = await Connection.findOne({ provider, externalId }).select('userId').lean<Pick<ConnectionDoc, 'userId'>>();
  if (owner && String(owner.userId) !== userId) {
    throw AppError.conflict(`That ${provider === 'discord' ? 'Discord' : 'Steam'} account is already linked to another TG Hub account`);
  }
  try {
    await Connection.updateOne({ userId, provider }, { $set: { externalId, ...fields } }, { upsert: true });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw AppError.conflict('That account was just linked somewhere else');
    throw error;
  }
}

export async function linkDiscord(userId: string, profile: DiscordProfile): Promise<void> {
  await link(userId, 'discord', profile.id, { username: profile.username, avatarUrl: profile.avatarUrl, profileUrl: null });
}

export async function linkSteam(userId: string, steamId: string): Promise<void> {
  const summary = await steamSummary(steamId).catch(() => null);
  await link(userId, 'steam', steamId, { username: summary?.personaName ?? null, avatarUrl: summary?.avatarUrl ?? null, profileUrl: steamProfileUrl(steamId) });
  if (env.STEAM_API_KEY) await syncSteamGames(userId, true).catch((error: unknown) => logger.warn({ err: error }, 'Steam games sync failed'));
}

export async function syncSteamGames(userId: string, force = false): Promise<Connections> {
  const steam = await Connection.findOne({ userId, provider: 'steam' }).lean<ConnectionDoc>();
  if (!steam) throw AppError.notFound('Steam connection');
  if (!env.STEAM_API_KEY) throw new AppError(503, 'STEAM_DISABLED', 'Steam library sync is not available on this server');
  if (!force && steam.gamesSyncedAt && Date.now() - steam.gamesSyncedAt.getTime() < STEAM_SYNC_COOLDOWN_MS) {
    throw new AppError(429, 'SYNC_TOO_SOON', 'Your library was just refreshed — try again in a few minutes');
  }
  const games = await steamOwnedGames(steam.externalId);
  await Connection.updateOne({ _id: steam._id }, { $set: { games, gamesSyncedAt: new Date() } });
  return listConnections(userId);
}

export async function unlinkConnection(userId: string, provider: ConnectionProvider): Promise<Connections> {
  if (provider === 'discord') {
    const user = await User.findById(userId).select('passwordSet').lean<Pick<UserDoc, 'passwordSet'>>();
    if (user?.passwordSet === false) {
      throw AppError.unprocessable('Set a password first (Sign in → Forgot password) so you can still get into your account');
    }
  }
  await Connection.deleteOne({ userId, provider });
  return listConnections(userId);
}

/* ───────────── Sign in with Discord ───────────── */

async function freeUsername(base: string): Promise<string> {
  let clean = base.replace(/[^a-zA-Z0-9_.]/g, '').slice(0, 16);
  if (clean.length < 3) clean = `player${clean}`.slice(0, 16);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? clean : `${clean}${Math.floor(100 + Math.random() * 9_900)}`.slice(0, 20);
    if (!(await User.exists({ usernameLower: candidate.toLowerCase() }))) return candidate;
  }
  return `player${randomBytes(4).toString('hex')}`;
}

/**
 * A linked Discord account signs straight in. An unknown one gets a new TG
 * Hub account — never silently attached to an existing account with the
 * same email, which would let anyone who controls that Discord take it over.
 */
export async function signInWithDiscord(profile: DiscordProfile, meta: ClientMeta): Promise<IssuedSession> {
  const linked = await Connection.findOne({ provider: 'discord', externalId: profile.id }).lean<ConnectionDoc>();
  if (linked) {
    const user = await User.findById(linked.userId).lean<UserDoc>();
    if (!user || user.status !== 'active') throw AppError.forbidden('This account is suspended');
    await Connection.updateOne({ _id: linked._id }, { $set: { username: profile.username, avatarUrl: profile.avatarUrl } });
    return startSession(user, meta);
  }

  if (!profile.email || !profile.emailVerified) {
    throw new AppError(422, 'DISCORD_EMAIL_MISSING', 'Your Discord account has no verified email — sign up with email instead');
  }
  if (await User.exists({ email: profile.email })) {
    throw new AppError(409, 'DISCORD_EMAIL_TAKEN', 'An account already uses that email. Sign in with your password, then connect Discord in Settings.');
  }

  const username = await freeUsername(profile.username);
  const user = await User.create({
    email: profile.email,
    username,
    usernameLower: username.toLowerCase(),
    displayName: profile.displayName.slice(0, 32),
    // Nobody knows this password; "Forgot password" sets a real one.
    passwordHash: await hashPassword(randomBytes(32).toString('base64url')),
    passwordSet: false,
    emailVerifiedAt: new Date(),
    avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
  });
  await linkDiscord(String(user._id), profile);
  bus.emit('user.registered', { userId: String(user._id) });

  if (profile.avatarUrl) {
    // Best effort: bring the Discord picture along through the normal image pipeline.
    try {
      const response = await fetch(profile.avatarUrl, { signal: AbortSignal.timeout(8_000) });
      if (response.ok) await setProfileImage(String(user._id), 'avatar', Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      logger.warn({ err: error }, 'Discord avatar import failed');
    }
  }
  return startSession(user.toObject(), meta);
}
