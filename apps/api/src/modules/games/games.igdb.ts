import type { Types, UpdateQuery } from 'mongoose';
import sharp from 'sharp';
import { z } from 'zod';
import type { AdminGames, GameDetail, IgdbSearchResult, IgdbSyncResult } from '@tgh/shared';
import { bus } from '../../core/events/bus';
import { AppError } from '../../core/http/errors';
import { UpstreamError } from '../../core/http/upstream';
import { logger } from '../../core/logger';
import { igdb, igdbConfigured, IgdbNotConfiguredError } from '../igdb/igdb.client';
import { IGDB_GAME_FIELDS, IGDB_PLAYABLE_GAME_TYPES, igdbImage, parseIgdbGame, type IgdbGame } from '../igdb/igdb.mapper';
import { Game, type GameDoc } from './game.model';
import { toGameDetail } from './games.mapper';

/** Daily is plenty: IGDB entries change slowly, and a restart shouldn't re-download everything. */
const STALE_AFTER_MS = 20 * 60 * 60 * 1000;
const BATCH = 25;
const STEAM_SOURCE = 1;
const TYPES = `(${IGDB_PLAYABLE_GAME_TYPES.join(',')})`;

let lastRun: AdminGames['lastSync'] = null;

/** Apicalypse strings are double-quoted; quotes and backslashes in a title must not end them early. */
const quote = (text: string) => `"${text.replace(/[\\"]/g, '\\$&')}"`;

/**
 * The fields IGDB owns, ready for `$set`. Anything IGDB leaves blank keeps the
 * catalogue's value. Genres are the exception: they drive the catalogue's
 * filters and IGDB's tags are broad (Marvel Rivals is "racing" there), so
 * IGDB only fills them for a game that has none yet.
 */
export function igdbUpdate(game: Pick<GameDoc, 'genres' | 'platforms' | 'description' | 'releaseDate' | 'developer' | 'publisher' | 'languages' | 'links' | 'steamAppId'>, data: IgdbGame, now: Date) {
  return {
    'igdb.id': data.igdbId,
    'igdb.url': data.url,
    'igdb.coverId': data.coverId,
    'igdb.artworkIds': data.artworkIds,
    'igdb.screenshotIds': data.screenshotIds,
    'igdb.videoIds': data.videoIds,
    'igdb.rating': data.rating,
    'igdb.ratingCount': data.ratingCount,
    'igdb.altNames': data.altNames,
    'igdb.syncedAt': now,
    description: data.summary || game.description,
    releaseDate: data.releaseDate ?? game.releaseDate,
    developer: data.developer || game.developer,
    publisher: data.publisher || game.publisher,
    genres: game.genres.length > 0 ? game.genres : data.genres,
    platforms: data.platforms.length > 0 ? data.platforms : game.platforms,
    modes: data.modes,
    languages: data.languages.length > 0 ? data.languages : game.languages,
    'links.official': data.links.official ?? game.links?.official ?? null,
    'links.store': data.links.store ?? game.links?.store ?? null,
    steamAppId: game.steamAppId ?? data.steamAppId,
  };
}

/* ───────────── Identity for imported games ───────────── */

/** "Counter-Strike 2" → "CS2", "Minecraft" → "MIN", "Cyberpunk 2077" → "CY". */
export function monogramFor(title: string): string {
  const words = title.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'G';
  if (words.length === 1) return words[0]!.slice(0, 3).toUpperCase();
  // Short numbers ("2", "V", "25") belong in the mark; years don't.
  let mark = words.map((word) => (/^\d{1,2}$/.test(word) ? word : /^\d+$/.test(word) ? '' : word[0])).join('');
  if (mark.length < 2) mark = words[0]!.slice(0, 2) + mark.slice(1);
  return mark.toUpperCase().slice(0, 4);
}

/** Card colour from the cover's dominant colour, kept dark and saturated enough for white text. */
export function accentFrom({ r, g, b }: { r: number; g: number; b: number }): string {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  // Greys stay grey; colours get enough saturation to read as the game's colour.
  const sat = s < 0.12 ? s : Math.max(s, 0.5);
  const light = Math.min(0.48, Math.max(0.3, l));
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (value: number) => Math.round((value + m) * 255).toString(16).padStart(2, '0');
  return `#${hex(r1)}${hex(g1)}${hex(b1)}`;
}

async function accentFromCover(coverId: string): Promise<string | null> {
  try {
    const response = await fetch(igdbImage(coverId, 'cover_small'), { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return null;
    const { dominant } = await sharp(Buffer.from(await response.arrayBuffer())).stats();
    return accentFrom(dominant);
  } catch {
    return null;
  }
}

/** First sentence of the summary, cut at a word, as the card's one-liner. */
export function taglineFrom(summary: string): string {
  const sentence = summary.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? summary;
  if (sentence.length <= 140) return sentence;
  return `${sentence.slice(0, 139).replace(/\s+\S*$/, '')}…`;
}

const slugify = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50) || 'game';

async function freeSlug(name: string, igdbId: number): Promise<string> {
  const base = slugify(name);
  return (await Game.exists({ slug: base })) ? `${base}-${igdbId}`.slice(0, 60) : base;
}

/* ───────────── Talking to IGDB ───────────── */

async function fetchIgdbGames(ids: number[]): Promise<Map<number, IgdbGame>> {
  const found = new Map<number, IgdbGame>();
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const rows = await igdb().query('games', `fields ${IGDB_GAME_FIELDS}; where id = (${chunk.join(',')}); limit ${chunk.length};`);
    for (const row of rows) {
      const game = parseIgdbGame(row);
      if (game) found.set(game.igdbId, game);
    }
  }
  return found;
}

const idRows = z.array(z.object({ id: z.number().optional(), game: z.number().optional(), uid: z.string().optional() })).catch([]);

/** Steam app id → IGDB id, for every game that has one, in one request. */
async function igdbIdsBySteam(steamIds: number[]): Promise<Map<number, number>> {
  if (steamIds.length === 0) return new Map();
  const rows = idRows.parse(
    await igdb().query('external_games', `fields game,uid; where external_game_source = ${STEAM_SOURCE} & uid = (${steamIds.map((id) => quote(String(id))).join(',')}); limit 500;`),
  );
  return new Map(rows.filter((row) => row.uid && row.game).map((row) => [Number(row.uid), row.game!]));
}

/** Exact (case-insensitive) title match among playable releases; the most-rated wins. */
async function igdbIdByTitle(title: string): Promise<number | null> {
  const rows = idRows.parse(await igdb().query('games', `fields id; where name ~ ${quote(title)} & game_type = ${TYPES}; sort total_rating_count desc; limit 1;`));
  return rows[0]?.id ?? null;
}

/* ───────────── Sync ───────────── */

/**
 * Links catalogue games to IGDB (Steam id first, then exact title) and copies
 * IGDB's data onto every linked game. `force` ignores the daily freshness rule.
 */
export async function syncIgdbCatalogue(options: { force?: boolean; only?: Array<string | Types.ObjectId> } = {}): Promise<IgdbSyncResult> {
  if (!igdbConfigured()) throw new IgdbNotConfiguredError();
  const games = await Game.find(options.only ? { _id: { $in: options.only } } : {}).lean<GameDoc[]>();
  const result: IgdbSyncResult = { updated: 0, linked: 0, failed: 0, unmatched: [] };
  const taken = new Set(games.map((game) => game.igdb?.id).filter((id): id is number => typeof id === 'number'));

  const unlinked = games.filter((game) => !game.igdb?.id);
  const bySteam = await igdbIdsBySteam(unlinked.flatMap((game) => (game.steamAppId ? [game.steamAppId] : [])));
  for (const game of unlinked) {
    const igdbId = (game.steamAppId ? bySteam.get(game.steamAppId) : undefined) ?? (await igdbIdByTitle(game.title));
    if (!igdbId || taken.has(igdbId)) {
      result.unmatched.push(game.slug);
      continue;
    }
    taken.add(igdbId);
    game.igdb = { ...game.igdb, id: igdbId, syncedAt: null };
    result.linked += 1;
  }

  const cutoff = Date.now() - STALE_AFTER_MS;
  const due = games.filter((game) => game.igdb?.id && (options.force || !game.igdb.syncedAt || game.igdb.syncedAt.getTime() < cutoff));
  const data = await fetchIgdbGames(due.map((game) => game.igdb.id!));
  const now = new Date();
  for (const game of due) {
    const entry = data.get(game.igdb.id!);
    if (!entry) {
      result.failed += 1;
      continue;
    }
    const update = igdbUpdate(game, entry, now);
    await Game.updateOne({ _id: game._id }, { $set: update });
    if (update.steamAppId && !game.steamAppId) bus.emit('game.on_steam', { gameId: String(game._id), steamAppId: update.steamAppId });
    result.updated += 1;
  }

  lastRun = { at: now.toISOString(), updated: result.updated, linked: result.linked, failed: result.failed };
  if (result.updated || result.linked || result.failed || result.unmatched.length) logger.info(result, 'IGDB catalogue sync');
  return result;
}

/** Adds an IGDB game to the catalogue, with a monogram, colour and one-liner made from IGDB's data. */
export async function importIgdbGame(igdbId: number): Promise<GameDetail> {
  if (await Game.exists({ 'igdb.id': igdbId })) throw AppError.conflict('That IGDB game is already in the catalogue');
  const data = (await fetchIgdbGames([igdbId])).get(igdbId);
  if (!data) throw AppError.notFound('IGDB game');
  const base = {
    genres: data.genres.length > 0 ? data.genres : ['action' as const],
    platforms: data.platforms.length > 0 ? data.platforms : ['pc' as const],
    description: '',
    releaseDate: null,
    developer: '',
    publisher: '',
    languages: [],
    links: { official: null, store: null },
    steamAppId: null,
  };
  const game = await Game.create({
    ...base,
    ...expand(igdbUpdate(base, data, new Date())),
    slug: await freeSlug(data.name, igdbId),
    title: data.name.slice(0, 80),
    titleLower: data.name.slice(0, 80).toLowerCase(),
    monogram: monogramFor(data.name),
    tagline: taglineFrom(data.summary),
    accent: (data.coverId ? await accentFromCover(data.coverId) : null) ?? '#e10600',
    freeToPlay: data.freeToPlay,
    popularity: 40,
    status: 'published',
  });
  logger.info({ igdbId, slug: game.slug }, 'Game imported from IGDB');
  if (game.steamAppId) bus.emit('game.on_steam', { gameId: String(game._id), steamAppId: game.steamAppId });
  return toGameDetail(game.toObject());
}

/** `{ 'igdb.id': 1, 'links.store': x }` → `{ igdb: { id: 1 }, links: { store: x } }`, for creating a document. */
function expand(flat: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, Record<string, unknown> | unknown> = {};
  for (const [path, value] of Object.entries(flat)) {
    const [head, tail] = path.split('.');
    if (tail) out[head!] = { ...((out[head!] as Record<string, unknown>) ?? {}), [tail]: value };
    else out[path] = value;
  }
  return out;
}

/** Points a catalogue game at a different IGDB entry (the automatic match was wrong, or there was none) and syncs it. */
export async function linkIgdbGame(gameId: string, igdbId: number): Promise<GameDetail> {
  const other = await Game.findOne({ 'igdb.id': igdbId, _id: { $ne: gameId } }).select('title').lean<Pick<GameDoc, 'title'>>();
  if (other) throw AppError.conflict(`That IGDB game is already linked to ${other.title}`);
  const update: UpdateQuery<GameDoc> = { $set: { 'igdb.id': igdbId, 'igdb.syncedAt': null } };
  const game = await Game.findByIdAndUpdate(gameId, update, { returnDocument: 'after' }).lean<GameDoc>();
  if (!game) throw AppError.notFound('Game');
  const result = await syncIgdbCatalogue({ only: [gameId], force: true });
  if (result.failed > 0) throw AppError.unprocessable('IGDB has no game with that id');
  return toGameDetail((await Game.findById(gameId).lean<GameDoc>())!);
}

const searchRows = z
  .array(
    z.object({
      id: z.number(),
      name: z.string(),
      url: z.string().nullish(),
      slug: z.string(),
      first_release_date: z.number().nullish(),
      cover: z.object({ image_id: z.string() }).nullish(),
      platforms: z.array(z.object({ abbreviation: z.string().nullish(), name: z.string() })).nullish(),
    }),
  )
  .catch([]);

export async function searchIgdb(term: string): Promise<IgdbSearchResult[]> {
  const rows = searchRows.parse(
    await igdb().query('games', `search ${quote(term)}; fields name,slug,url,first_release_date,cover.image_id,platforms.abbreviation,platforms.name; where game_type = ${TYPES}; limit 12;`),
  );
  const linked = await Game.find({ 'igdb.id': { $in: rows.map((row) => row.id) } }).select('slug igdb.id').lean<Array<Pick<GameDoc, 'slug' | 'igdb'>>>();
  const slugByIgdb = new Map(linked.map((game) => [game.igdb.id, game.slug]));
  return rows.map((row) => ({
    igdbId: row.id,
    name: row.name,
    releaseYear: row.first_release_date ? new Date(row.first_release_date * 1000).getUTCFullYear() : null,
    coverUrl: row.cover ? igdbImage(row.cover.image_id, 'cover_small') : null,
    platforms: (row.platforms ?? []).map((platform) => platform.abbreviation || platform.name).slice(0, 6),
    igdbUrl: row.url ?? `https://www.igdb.com/games/${row.slug}`,
    inCatalogue: slugByIgdb.get(row.id) ?? null,
  }));
}

export async function listAdminGames(): Promise<AdminGames> {
  const games = await Game.find().sort({ titleLower: 1 }).select('slug title status coverUrl igdb').lean<GameDoc[]>();
  return {
    igdbConfigured: igdbConfigured(),
    lastSync: lastRun,
    games: games.map((game) => ({
      id: String(game._id),
      slug: game.slug,
      title: game.title,
      coverUrl: game.igdb?.coverId ? igdbImage(game.igdb.coverId, 'cover_small') : game.coverUrl,
      status: game.status,
      igdbId: game.igdb?.id ?? null,
      igdbUrl: game.igdb?.url ?? null,
      igdbSyncedAt: game.igdb?.syncedAt?.toISOString() ?? null,
    })),
  };
}

/** For admin requests: IGDB trouble (bad keys, rate limit, outage) becomes a readable 422 instead of a 500. */
export async function withIgdbErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof UpstreamError || error instanceof IgdbNotConfiguredError) throw AppError.unprocessable(error.message);
    throw error;
  }
}
