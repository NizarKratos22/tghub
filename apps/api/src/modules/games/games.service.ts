import type { QueryFilter, Types } from 'mongoose';
import type { GameDetail, GameInput, GameListQuery, GameRef, GameSummary, GameUpdateInput, Page } from '@tgh/shared';
import { AppError } from '../../core/http/errors';
import { escapeRegex, paginate, skipFor } from '../../core/http/utils';
import { Game, type GameDoc } from './game.model';
import { GAME_REF_FIELDS, GAME_SUMMARY_FIELDS, toGameDetail, toGameRef, toGameSummary } from './games.mapper';

const SORTS = {
  popular: { popularity: -1, titleLower: 1 },
  newest: { releaseDate: -1, titleLower: 1 },
  title: { titleLower: 1 },
} as const;

export async function listGames(query: GameListQuery): Promise<Page<GameSummary>> {
  const filter: QueryFilter<GameDoc> = { status: 'published' };

  if (query.q) {
    const term = query.q.toLowerCase();
    filter.$or = [{ titleLower: { $regex: escapeRegex(term) } }, { aliases: term }, { 'igdb.altNames': term }, { tags: term }];
  }
  if (query.genre) filter.genres = query.genre;
  if (query.platform) filter.platforms = query.platform;
  if (query.free !== undefined) filter.freeToPlay = query.free;

  const [games, total] = await Promise.all([
    Game.find(filter)
      .sort(SORTS[query.sort])
      .skip(skipFor(query.page, query.pageSize))
      .limit(query.pageSize)
      .select(GAME_SUMMARY_FIELDS)
      .lean<GameDoc[]>(),
    Game.countDocuments(filter),
  ]);

  return paginate(games.map(toGameSummary), total, query.page, query.pageSize);
}

export async function searchGames(term: string, limit: number): Promise<GameSummary[]> {
  const lower = term.toLowerCase();
  const games = await Game.find({
    status: 'published',
    $or: [{ titleLower: { $regex: escapeRegex(lower) } }, { aliases: lower }, { 'igdb.altNames': lower }, { tags: lower }],
  })
    .sort(SORTS.popular)
    .limit(limit)
    .select(GAME_SUMMARY_FIELDS)
    .lean<GameDoc[]>();
  return games.map(toGameSummary);
}

export async function featuredGames(limit: number): Promise<GameSummary[]> {
  const games = await Game.find({ status: 'published' })
    .sort({ featured: -1, popularity: -1 })
    .limit(limit)
    .select(GAME_SUMMARY_FIELDS)
    .lean<GameDoc[]>();
  return games.map(toGameSummary);
}

export async function findGameBySlug(slug: string): Promise<GameDoc> {
  const game = await Game.findOne({ slug, status: 'published' }).lean<GameDoc>();
  if (!game) throw AppError.notFound('Game');
  return game;
}

export async function getGameDetail(slug: string): Promise<GameDetail> {
  return toGameDetail(await findGameBySlug(slug));
}

export async function gameExists(id: Types.ObjectId | string): Promise<boolean> {
  return Boolean(await Game.exists({ _id: id }));
}

export async function gameSummariesByIds(ids: Array<Types.ObjectId | string>): Promise<GameSummary[]> {
  if (ids.length === 0) return [];
  const games = await Game.find({ _id: { $in: ids }, status: 'published' }).select(GAME_SUMMARY_FIELDS).lean<GameDoc[]>();
  const byId = new Map(games.map((game) => [String(game._id), toGameSummary(game)]));
  // Preserve the caller's order (e.g. most recently bookmarked first).
  return ids.map((id) => byId.get(String(id))).filter((game): game is GameSummary => Boolean(game));
}

/** IGDB screenshots per game (key art when there are none; it is often a logo) — the fallback pictures for Radar stories about it. */
export async function gameArtMap(ids: Array<Types.ObjectId | string | null | undefined>): Promise<Map<string, string[]>> {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (unique.length === 0) return new Map();
  const games = await Game.find({ _id: { $in: unique } }).select('igdb.artworkIds igdb.screenshotIds').lean<Array<Pick<GameDoc, '_id' | 'igdb'>>>();
  return new Map(games.map((game) => [String(game._id), game.igdb?.screenshotIds?.length ? game.igdb.screenshotIds : (game.igdb?.artworkIds ?? [])]));
}

/** Batch lookup so feeds don't do one query per item. */
export async function gameRefMap(ids: Array<Types.ObjectId | string | null | undefined>): Promise<Map<string, GameRef>> {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  if (unique.length === 0) return new Map();
  const games = await Game.find({ _id: { $in: unique } }).select(GAME_REF_FIELDS).lean<GameDoc[]>();
  return new Map(games.map((game) => [String(game._id), toGameRef(game)]));
}

export async function createGame(input: GameInput): Promise<GameDetail> {
  if (await Game.exists({ slug: input.slug })) throw AppError.conflict('A game with this slug already exists');
  const game = await Game.create({ ...input, titleLower: input.title.toLowerCase() });
  return toGameDetail(game.toObject());
}

export async function updateGame(id: string, input: GameUpdateInput): Promise<GameDetail> {
  const update: Partial<GameDoc> = { ...input };
  if (input.title) update.titleLower = input.title.toLowerCase();
  const game = await Game.findByIdAndUpdate(id, { $set: update }, { returnDocument: 'after' }).lean<GameDoc>();
  if (!game) throw AppError.notFound('Game');
  return toGameDetail(game);
}
