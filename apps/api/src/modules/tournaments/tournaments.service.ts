import type { QueryFilter, SortOrder, Types } from 'mongoose';
import type {
  AdminTournament,
  AdminTournamentUpdateInput,
  Page,
  TournamentDetail,
  TournamentListQuery,
  TournamentSummary,
} from '@tgh/shared';
import { bus } from '../../core/events/bus';
import { AppError, isDuplicateKeyError } from '../../core/http/errors';
import { escapeRegex, paginate, skipFor, toObjectId } from '../../core/http/utils';
import { Game } from '../games/game.model';
import { gameExists, gameRefMap } from '../games/games.service';
import { FINAL_STATES, Tournament, TournamentFollow, TournamentSource, type TournamentDoc } from './tournament.model';
import { deriveStatus, listFilter } from './tournament.status';
import { toAdminTournament, toTournamentDetail, toTournamentSummaries } from './tournaments.mapper';

const VISIBLE = { hidden: false };

export async function listTournaments(query: TournamentListQuery): Promise<Page<TournamentSummary>> {
  const clauses: QueryFilter<TournamentDoc>[] = [VISIBLE, listFilter(query.list)];

  if (query.where === 'tn') clauses.push({ isLocal: true });
  if (query.where === 'online') clauses.push({ online: true });
  if (query.provider) clauses.push({ provider: query.provider });
  if (query.q) clauses.push({ nameLower: { $regex: escapeRegex(query.q.toLowerCase()) } });
  if (query.game) {
    const game = await Game.findOne({ slug: query.game }).select('_id').lean();
    if (!game) return paginate([], 0, query.page, query.pageSize);
    clauses.push({ gameId: game._id });
  }

  const filter: QueryFilter<TournamentDoc> = { $and: clauses };
  // Results read newest first; everything else in calendar order.
  const sort: Record<string, SortOrder> = query.list === 'completed' ? { startsAt: -1 } : { startsAt: 1 };

  const [docs, total] = await Promise.all([
    Tournament.find(filter).sort(sort).skip(skipFor(query.page, query.pageSize)).limit(query.pageSize).lean<TournamentDoc[]>(),
    Tournament.countDocuments(filter),
  ]);
  return paginate(await toTournamentSummaries(docs), total, query.page, query.pageSize);
}

async function visibleBySlug(slug: string): Promise<TournamentDoc> {
  const doc = await Tournament.findOne({ slug, ...VISIBLE }).lean<TournamentDoc>();
  if (!doc) throw AppError.notFound('Tournament');
  return doc;
}

export async function getTournament(slug: string): Promise<TournamentDetail> {
  const doc = await visibleBySlug(slug);
  const [games, followers] = await Promise.all([gameRefMap([doc.gameId]), TournamentFollow.countDocuments({ tournamentId: doc._id })]);
  return toTournamentDetail(doc, games, followers);
}

/** Front page: featured first, then Tunisian events, then the soonest. */
export async function tournamentsForHome(limit: number): Promise<TournamentSummary[]> {
  const docs = await Tournament.find({ $and: [VISIBLE, listFilter('upcoming')] })
    .sort({ featured: -1, isLocal: -1, startsAt: 1 })
    .limit(limit)
    .lean<TournamentDoc[]>();
  return toTournamentSummaries(docs);
}

export async function upcomingForGame(gameId: Types.ObjectId | string, limit: number): Promise<TournamentSummary[]> {
  const docs = await Tournament.find({ $and: [VISIBLE, listFilter('upcoming'), { gameId }] })
    .sort({ startsAt: 1 })
    .limit(limit)
    .lean<TournamentDoc[]>();
  return toTournamentSummaries(docs);
}

export async function searchTournaments(q: string, limit: number): Promise<TournamentSummary[]> {
  const docs = await Tournament.find({
    $and: [VISIBLE, listFilter('upcoming'), { nameLower: { $regex: escapeRegex(q.toLowerCase()) } }],
  })
    .sort({ startsAt: 1 })
    .limit(limit)
    .lean<TournamentDoc[]>();
  return toTournamentSummaries(docs);
}

export async function upcomingCount(): Promise<number> {
  return Tournament.countDocuments({ $and: [VISIBLE, listFilter('upcoming')] });
}

/* ───────────── Follows (reminder subscriptions) ───────────── */

export async function followTournament(userId: string, slug: string): Promise<void> {
  const doc = await visibleBySlug(slug);
  const status = deriveStatus(doc);
  if (status === 'completed' || status === 'cancelled') throw AppError.unprocessable('This tournament is over');
  try {
    await TournamentFollow.create({ userId, tournamentId: doc._id });
  } catch (error) {
    if (isDuplicateKeyError(error)) return;
    throw error;
  }
  bus.emit('tournament.followed', { userId, tournamentId: String(doc._id) });
}

export async function unfollowTournament(userId: string, slug: string): Promise<void> {
  const doc = await Tournament.findOne({ slug }).select('_id').lean();
  if (!doc) throw AppError.notFound('Tournament');
  await TournamentFollow.deleteOne({ userId, tournamentId: doc._id });
}

export async function followedIds(userId: string): Promise<string[]> {
  const rows = await TournamentFollow.find({ userId }).select('tournamentId').lean();
  return rows.map((row) => String(row.tournamentId));
}

/** The player's tournaments that haven't finished, soonest first. */
export async function followedTournaments(userId: string): Promise<TournamentSummary[]> {
  const ids = await TournamentFollow.find({ userId }).select('tournamentId').lean();
  if (ids.length === 0) return [];
  const docs = await Tournament.find({
    _id: { $in: ids.map((row) => row.tournamentId) },
    ...VISIBLE,
    providerState: { $nin: FINAL_STATES },
  })
    .sort({ startsAt: 1 })
    .limit(20)
    .lean<TournamentDoc[]>();
  // The provider may not have reported the end yet; derived status catches it.
  return (await toTournamentSummaries(docs)).filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
}

/* ───────────── Admin ───────────── */

export async function adminListTournaments(query: { q?: string; page: number; pageSize: number }): Promise<Page<AdminTournament>> {
  const filter: QueryFilter<TournamentDoc> = query.q ? { nameLower: { $regex: escapeRegex(query.q.toLowerCase()) } } : {};
  const [docs, total] = await Promise.all([
    Tournament.find(filter).sort({ startsAt: -1 }).skip(skipFor(query.page, query.pageSize)).limit(query.pageSize).lean<TournamentDoc[]>(),
    Tournament.countDocuments(filter),
  ]);
  const [games, sources] = await Promise.all([
    gameRefMap(docs.map((doc) => doc.gameId)),
    TournamentSource.find({ _id: { $in: docs.map((doc) => doc.sourceId).filter(Boolean) } }).select('name').lean(),
  ]);
  const sourceNames = new Map(sources.map((source) => [String(source._id), source.name]));
  return paginate(
    docs.map((doc) => toAdminTournament(doc, games, sourceNames)),
    total,
    query.page,
    query.pageSize,
  );
}

export async function adminUpdateTournament(id: string, input: AdminTournamentUpdateInput): Promise<AdminTournament> {
  if (input.gameId && !(await gameExists(input.gameId))) {
    throw AppError.unprocessable('Unknown game', { fields: { gameId: 'Unknown game' } });
  }
  const set = { ...input, ...(input.gameId !== undefined ? { gameId: input.gameId ? toObjectId(input.gameId) : null } : {}) };
  const doc = await Tournament.findByIdAndUpdate(id, { $set: set }, { returnDocument: 'after' }).lean<TournamentDoc>();
  if (!doc) throw AppError.notFound('Tournament');
  return toAdminTournament(doc, await gameRefMap([doc.gameId]), new Map());
}
