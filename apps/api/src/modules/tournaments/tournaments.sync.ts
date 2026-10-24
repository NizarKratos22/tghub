import { createHash } from 'node:crypto';
import type { Types } from 'mongoose';
import {
  DISCOVERY_PROVIDERS,
  TOURNAMENT_PROVIDER_META,
  type DiscoveryProvider,
  type TournamentImportResult,
  type TournamentProvider,
  type TournamentProviderInfo,
  type TournamentSource as TournamentSourceDto,
  type TournamentSourceInput,
  type TournamentSourceRunResult,
  type TournamentSourceUpdateInput,
} from '@tgh/shared';
import { AppError } from '../../core/http/errors';
import { UpstreamError } from '../../core/http/upstream';
import { failureUpdate, isDue, successUpdate } from '../../core/ingest/source-health';
import { logger } from '../../core/logger';
import { formatTunis } from '../../core/time/periods';
import { publishAlert } from '../alerts/alerts.service';
import { Game, type GameDoc } from '../games/game.model';
import { gameExists, gameRefMap } from '../games/games.service';
import { faceitProvider } from './providers/faceit.provider';
import { ProviderNotConfiguredError, type ExternalTournament, type TournamentProviderAdapter } from './providers/provider';
import { startggProvider } from './providers/startgg.provider';
import { FINAL_STATES, Tournament, TournamentFollow, TournamentSource, type TournamentDoc, type TournamentSourceDoc } from './tournament.model';
import { deriveStatus } from './tournament.status';
import { toTournamentSourceDto, toTournamentSummaries } from './tournaments.mapper';

const adapters: Record<DiscoveryProvider, TournamentProviderAdapter> = {
  startgg: startggProvider,
  faceit: faceitProvider,
};

const HOUR = 60 * 60 * 1000;

export function providerInfo(): TournamentProviderInfo[] {
  return DISCOVERY_PROVIDERS.map((provider) => {
    const adapter = adapters[provider];
    return { provider, label: adapter.label, configured: adapter.configured(), credentialEnv: adapter.credentialEnv };
  });
}

/* ───────────── Mapping helpers ───────────── */

export type GameMatcher = (name: string | null | undefined) => Types.ObjectId | null;

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[®™]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Matches provider game names ("TEKKEN 8", FACEIT's "cs2") against catalogue titles, slugs and aliases. */
export async function loadGameMatcher(): Promise<GameMatcher> {
  const games = await Game.find().select('_id slug titleLower aliases').lean<Array<Pick<GameDoc, '_id' | 'slug' | 'titleLower' | 'aliases'>>>();
  const index = new Map<string, Types.ObjectId>();
  for (const game of games) {
    index.set(normalizeName(game.titleLower), game._id);
    index.set(normalizeName(game.slug), game._id);
    for (const alias of game.aliases) index.set(normalizeName(alias), game._id);
  }
  return (name) => (name ? (index.get(normalizeName(name)) ?? null) : null);
}

export function tournamentSlug(name: string, provider: TournamentProvider, externalId: string): string {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 60)
      .replace(/^-+|-+$/g, '') || 'tournament';
  // Short stable hash keeps slugs unique when two platforms use the same name.
  const hash = createHash('sha1').update(`${provider}:${externalId}`).digest('hex').slice(0, 6);
  return `${base}-${hash}`;
}

/* ───────────── Upsert + announce ───────────── */

interface UpsertOptions {
  matchGame: GameMatcher;
  sourceId?: Types.ObjectId | null;
  /** A source's configured game wins over name matching. */
  gameId?: Types.ObjectId | null;
}

/** Idempotent on (provider, externalId). Moderation fields (hidden, featured, an admin-set game) are never overwritten. */
export async function upsertTournament(
  provider: TournamentProvider,
  external: ExternalTournament,
  options: UpsertOptions,
): Promise<{ doc: TournamentDoc; created: boolean }> {
  const existing = await Tournament.findOne({ provider, externalId: external.externalId }).select('_id gameId').lean();
  const gameId =
    options.gameId ?? options.matchGame(external.gameName) ?? options.matchGame(external.events[0]?.gameName) ?? null;

  const synced = {
    name: external.name,
    nameLower: external.name.toLowerCase(),
    url: external.url,
    description: external.description,
    organizer: external.organizer,
    gameName: external.gameName,
    imageUrl: external.imageUrl,
    startsAt: external.startsAt,
    endsAt: external.endsAt,
    providerState: external.state,
    registration: external.registration,
    online: external.online,
    location: external.location,
    isLocal: external.location?.countryCode === 'TN',
    region: external.region,
    teamSize: external.teamSize,
    format: external.format,
    participants: external.participants,
    prize: external.prize,
    events: external.events,
    lastSyncedAt: new Date(),
  };

  const doc = await Tournament.findOneAndUpdate(
    { provider, externalId: external.externalId },
    {
      $set: { ...synced, ...(existing && !existing.gameId && gameId ? { gameId } : {}) },
      ...(existing
        ? {}
        : {
            $setOnInsert: {
              slug: tournamentSlug(external.name, provider, external.externalId),
              gameId,
              sourceId: options.sourceId ?? null,
              hidden: false,
              featured: false,
            },
          }),
    },
    { upsert: true, returnDocument: 'after' },
  ).lean<TournamentDoc>();

  return { doc: doc!, created: !existing };
}

function describe(doc: TournamentDoc, gameTitle: string | null): string {
  const parts = [
    gameTitle ?? doc.gameName,
    doc.online ? 'Online' : (doc.location?.city ?? null),
    `starts ${formatTunis(doc.startsAt)}`,
    doc.registration.closesAt ? `registration closes ${formatTunis(doc.registration.closesAt)}` : null,
  ];
  return parts.filter(Boolean).join(' · ');
}

/**
 * New tournaments become alerts when they're relevant: everything in Tunisia
 * reaches everyone; elsewhere only followers of a catalogue game hear about it.
 */
export async function announceTournament(doc: TournamentDoc): Promise<boolean> {
  if (doc.hidden) return false;
  const status = deriveStatus(doc);
  if (status !== 'registration_open' && status !== 'upcoming') return false;
  if (!doc.isLocal && !doc.gameId) return false;

  const games = await gameRefMap([doc.gameId]);
  const game = doc.gameId ? games.get(String(doc.gameId)) : undefined;
  const { duplicate } = await publishAlert({
    category: 'tournament',
    title: doc.isLocal ? `New in Tunisia: ${doc.name}` : doc.name,
    summary: describe(doc, game?.title ?? null),
    url: `/tournaments/${doc.slug}`,
    gameId: doc.gameId ? String(doc.gameId) : null,
    sourceName: TOURNAMENT_PROVIDER_META[doc.provider].label,
    dedupKey: `tourney:new:${doc.provider}:${doc.externalId}`,
    audience: doc.isLocal ? 'everyone' : 'game_followers',
  });
  return !duplicate;
}

/* ───────────── Sources (discovery feeds) ───────────── */

async function sourceDtos(docs: TournamentSourceDoc[]): Promise<TournamentSourceDto[]> {
  const games = await gameRefMap(docs.map((doc) => doc.gameId));
  return docs.map((doc) => toTournamentSourceDto(doc, games));
}

export async function listSources(): Promise<TournamentSourceDto[]> {
  return sourceDtos(await TournamentSource.find().sort({ name: 1 }).lean<TournamentSourceDoc[]>());
}

export async function createSource(input: TournamentSourceInput): Promise<TournamentSourceDto> {
  if (input.gameId && !(await gameExists(input.gameId))) {
    throw AppError.unprocessable('Unknown game', { fields: { gameId: 'Unknown game' } });
  }
  const doc = await TournamentSource.create(input);
  const [dto] = await sourceDtos([doc.toObject()]);
  return dto!;
}

export async function updateSource(id: string, input: TournamentSourceUpdateInput): Promise<TournamentSourceDto> {
  const set = input.enabled ? { ...input, consecutiveFailures: 0 } : input;
  const doc = await TournamentSource.findByIdAndUpdate(id, { $set: set }, { returnDocument: 'after' }).lean<TournamentSourceDoc>();
  if (!doc) throw AppError.notFound('Tournament source');
  const [dto] = await sourceDtos([doc]);
  return dto!;
}

export async function deleteSource(id: string): Promise<void> {
  const result = await TournamentSource.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw AppError.notFound('Tournament source');
}

async function run(source: TournamentSourceDoc): Promise<TournamentSourceRunResult> {
  const startedAt = new Date();
  try {
    const items = await adapters[source.provider].discover(source.config);
    const matchGame = await loadGameMatcher();
    let created = 0;
    let updated = 0;
    for (const item of items) {
      const result = await upsertTournament(source.provider, item, { matchGame, sourceId: source._id, gameId: source.gameId });
      if (result.created) {
        created += 1;
        await announceTournament(result.doc);
      } else {
        updated += 1;
      }
    }
    const doc = await TournamentSource.findByIdAndUpdate(source._id, successUpdate(startedAt, created), {
      returnDocument: 'after',
    }).lean<TournamentSourceDoc>();
    logger.info({ source: source.name, fetched: items.length, created, updated }, 'Tournament source run complete');
    const [dto] = await sourceDtos([doc!]);
    return { source: dto!, fetched: items.length, created, updated };
  } catch (error) {
    const doc = await TournamentSource.findByIdAndUpdate(source._id, failureUpdate(source, startedAt, error), {
      returnDocument: 'after',
    }).lean<TournamentSourceDoc>();
    logger.warn({ source: source.name, err: error instanceof Error ? error.message : error }, 'Tournament source run failed');
    const [dto] = await sourceDtos([doc!]);
    return { source: dto!, fetched: 0, created: 0, updated: 0 };
  }
}

export async function runSource(id: string): Promise<TournamentSourceRunResult> {
  const source = await TournamentSource.findById(id).lean<TournamentSourceDoc>();
  if (!source) throw AppError.notFound('Tournament source');
  return run(source);
}

/** Job: discovery for every source whose interval elapsed. Unconfigured providers are skipped, not failed. */
export async function runDueTournamentSources(): Promise<void> {
  const sources = await TournamentSource.find({ enabled: true }).lean<TournamentSourceDoc[]>();
  for (const source of sources) {
    if (adapters[source.provider].configured() && isDue(source)) await run(source);
  }
}

/* ───────────── Refresh, import ───────────── */

async function refresh(doc: TournamentDoc, matchGame: GameMatcher): Promise<TournamentDoc> {
  if (doc.provider === 'sample') throw AppError.unprocessable('Sample tournaments are fixtures and do not sync');
  const external = await adapters[doc.provider].fetchOne(doc.externalId);
  if (!external) {
    // Gone or private on the platform: keep the record, stop showing it as active.
    return (await Tournament.findByIdAndUpdate(
      doc._id,
      { $set: { providerState: 'cancelled', lastSyncedAt: new Date() } },
      { returnDocument: 'after' },
    ).lean<TournamentDoc>())!;
  }
  return (await upsertTournament(doc.provider, external, { matchGame })).doc;
}

/**
 * Job: keeps registration state, entrants and results current for tournaments
 * that still matter. Live ones refresh every 30 min, others every 3 h.
 */
export async function refreshActiveTournaments(limit = 20): Promise<void> {
  const now = Date.now();
  const configured = DISCOVERY_PROVIDERS.filter((p) => adapters[p].configured());
  if (configured.length === 0) return;

  const candidates = await Tournament.find({
    provider: { $in: configured },
    providerState: { $nin: FINAL_STATES },
    startsAt: { $gte: new Date(now - 3 * 24 * HOUR), $lte: new Date(now + 60 * 24 * HOUR) },
    lastSyncedAt: { $lt: new Date(now - 30 * 60 * 1000) },
  })
    .sort({ startsAt: 1 })
    .limit(limit * 2)
    .lean<TournamentDoc[]>();

  const due = candidates
    .filter((doc) => {
      const live = doc.startsAt.getTime() <= now;
      return now - (doc.lastSyncedAt?.getTime() ?? 0) >= (live ? 0.5 : 3) * HOUR;
    })
    .slice(0, limit);
  if (due.length === 0) return;

  const matchGame = await loadGameMatcher();
  for (const doc of due) {
    try {
      await refresh(doc, matchGame);
    } catch (error) {
      logger.warn({ tournament: doc.slug, err: error instanceof Error ? error.message : error }, 'Tournament refresh failed');
      // Back off this one instead of retrying it every tick.
      await Tournament.updateOne({ _id: doc._id }, { $set: { lastSyncedAt: new Date() } });
    }
  }
}

export async function syncTournamentNow(id: string): Promise<TournamentDoc> {
  const doc = await Tournament.findById(id).lean<TournamentDoc>();
  if (!doc) throw AppError.notFound('Tournament');
  try {
    return await refresh(doc, await loadGameMatcher());
  } catch (error) {
    if (error instanceof UpstreamError || error instanceof ProviderNotConfiguredError) throw AppError.unprocessable(error.message);
    throw error;
  }
}

/** Admin pastes a public start.gg / FACEIT URL; we pull it from that platform. */
export async function importFromUrl(rawUrl: string): Promise<TournamentImportResult> {
  const url = new URL(rawUrl);
  const adapter = DISCOVERY_PROVIDERS.map((p) => adapters[p]).find((a) => a.matchesUrl(url));
  if (!adapter) {
    throw AppError.unprocessable('Unsupported link — paste a start.gg tournament or FACEIT championship URL', {
      fields: { url: 'Use a start.gg or FACEIT tournament page' },
    });
  }
  if (!adapter.configured()) {
    throw AppError.unprocessable(`${adapter.label} isn't connected yet — set ${adapter.credentialEnv} on the API server`);
  }

  let external: ExternalTournament | null;
  try {
    external = await adapter.fetchFromUrl(url);
  } catch (error) {
    if (error instanceof UpstreamError) throw AppError.unprocessable(error.message);
    throw error;
  }
  if (!external) throw AppError.notFound(`Tournament on ${adapter.label}`);

  const { doc, created } = await upsertTournament(adapter.provider, external, { matchGame: await loadGameMatcher() });
  if (created) await announceTournament(doc);
  const [tournament] = await toTournamentSummaries([doc]);
  return { tournament: tournament!, created };
}

/* ───────────── Reminders for followers ───────────── */

async function followerIds(tournamentId: Types.ObjectId): Promise<string[]> {
  const rows = await TournamentFollow.find({ tournamentId }).select('userId').lean();
  return rows.map((row) => String(row.userId));
}

/**
 * Job: personal reminders to followers — registration closing within 24 h,
 * start within 1 h. Each fires once per tournament (dedup key).
 */
export async function sendTournamentReminders(now = new Date()): Promise<void> {
  const followed = await TournamentFollow.distinct('tournamentId');
  if (followed.length === 0) return;
  const base = { _id: { $in: followed }, hidden: false, providerState: { $nin: FINAL_STATES } };

  const closing = await Tournament.find({
    ...base,
    'registration.isOpen': { $ne: false },
    'registration.closesAt': { $gt: now, $lte: new Date(now.getTime() + 24 * HOUR) },
  }).lean<TournamentDoc[]>();

  for (const doc of closing) {
    const recipients = await followerIds(doc._id);
    if (recipients.length === 0) continue;
    await publishAlert(
      {
        category: 'tournament',
        title: `Registration closes soon: ${doc.name}`,
        summary: `Closes ${formatTunis(doc.registration.closesAt!)}. Sign up on ${TOURNAMENT_PROVIDER_META[doc.provider].label}.`,
        url: `/tournaments/${doc.slug}`,
        gameId: doc.gameId ? String(doc.gameId) : null,
        sourceName: 'TG Hub Tournaments',
        dedupKey: `tourney:regclose:${doc._id}`,
      },
      { recipients },
    );
  }

  const starting = await Tournament.find({
    ...base,
    startsAt: { $gt: now, $lte: new Date(now.getTime() + HOUR) },
  }).lean<TournamentDoc[]>();

  for (const doc of starting) {
    const recipients = await followerIds(doc._id);
    if (recipients.length === 0) continue;
    await publishAlert(
      {
        category: 'tournament',
        title: `Starting within the hour: ${doc.name}`,
        summary: `Kick-off ${formatTunis(doc.startsAt)}. Check in on ${TOURNAMENT_PROVIDER_META[doc.provider].label} if the organizer requires it.`,
        url: `/tournaments/${doc.slug}`,
        gameId: doc.gameId ? String(doc.gameId) : null,
        sourceName: 'TG Hub Tournaments',
        dedupKey: `tourney:start:${doc._id}`,
      },
      { recipients },
    );
  }
}
