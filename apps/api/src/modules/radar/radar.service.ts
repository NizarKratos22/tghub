import type { QueryFilter, SortOrder, Types } from 'mongoose';
import { RESOURCE_KINDS, type Page, type RadarKindCounts, type RadarListQuery, type RadarSearchResult, type Resource as ResourceDto, type ResourceInput, type ResourceKind } from '@tgh/shared';
import type { AuthContext } from '../../core/auth/context';
import { bus } from '../../core/events/bus';
import { firstTime } from '../../core/events/once';
import { AppError } from '../../core/http/errors';
import { escapeRegex, paginate, skipFor } from '../../core/http/utils';
import { dayKey } from '../../core/time/periods';
import { Game } from '../games/game.model';
import { gameExists, searchGames } from '../games/games.service';
import { searchTournaments } from '../tournaments/tournaments.service';
import { toResources } from './radar.mapper';
import { Resource, type ResourceDoc } from './resource.model';

function activeClause(now: Date): QueryFilter<ResourceDoc> {
  return { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] };
}

function textClause(q: string): QueryFilter<ResourceDoc> {
  const term = q.toLowerCase();
  return { $or: [{ titleLower: { $regex: escapeRegex(term) } }, { tags: term }] };
}

/** Status, game and search clauses shared by the feed and its tab counts; null when the game doesn't exist. */
async function baseClauses(query: Pick<RadarListQuery, 'q' | 'game'>): Promise<QueryFilter<ResourceDoc>[] | null> {
  const clauses: QueryFilter<ResourceDoc>[] = [{ status: 'published' }];
  if (query.game) {
    const game = await Game.findOne({ slug: query.game }).select('_id').lean();
    if (!game) return null;
    clauses.push({ gameId: game._id });
  }
  if (query.q) clauses.push(textClause(query.q));
  return clauses;
}

export async function listResources(query: RadarListQuery): Promise<Page<ResourceDto>> {
  const now = new Date();
  const clauses = await baseClauses(query);
  if (!clauses) return paginate([], 0, query.page, query.pageSize);
  if (query.kind) clauses.push({ kind: query.kind });
  if (query.active) clauses.push(activeClause(now));

  const filter: QueryFilter<ResourceDoc> = { $and: clauses };
  // Events read like a calendar; everything else like a feed.
  const sort: Record<string, SortOrder> = query.kind === 'event' ? { startsAt: 1 } : { publishedAt: -1 };

  const [docs, total] = await Promise.all([
    Resource.find(filter).sort(sort).skip(skipFor(query.page, query.pageSize)).limit(query.pageSize).lean<ResourceDoc[]>(),
    Resource.countDocuments(filter),
  ]);
  return paginate(await toResources(docs), total, query.page, query.pageSize);
}

const TIMED_KINDS = new Set<ResourceKind>(['deal', 'event']);

/** How many items each Radar tab holds. Deals and events count only running ones, like their tabs show by default. */
export async function radarKindCounts(query: Pick<RadarListQuery, 'q' | 'game'>): Promise<RadarKindCounts> {
  const counts = Object.fromEntries([...RESOURCE_KINDS, 'all'].map((kind) => [kind, 0])) as RadarKindCounts;
  const clauses = await baseClauses(query);
  if (!clauses) return counts;
  const now = new Date();
  const rows = await Resource.aggregate<{ _id: ResourceKind; total: number; running: number }>([
    { $match: { $and: clauses } },
    {
      $group: {
        _id: '$kind',
        total: { $sum: 1 },
        running: { $sum: { $cond: [{ $or: [{ $eq: [{ $ifNull: ['$expiresAt', null] }, null] }, { $gt: ['$expiresAt', now] }] }, 1, 0] } },
      },
    },
  ]);
  for (const row of rows) {
    counts[row._id] = TIMED_KINDS.has(row._id) ? row.running : row.total;
    counts.all += row.total;
  }
  return counts;
}

export async function radarSearch(q: string, auth: AuthContext | null, track = true): Promise<RadarSearchResult> {
  const [games, tournaments, docs] = await Promise.all([
    searchGames(q, 6),
    searchTournaments(q, 5),
    Resource.find({ $and: [{ status: 'published' }, textClause(q)] })
      .sort({ publishedAt: -1 })
      .limit(12)
      .lean<ResourceDoc[]>(),
  ]);
  // Repeating the same search doesn't count twice towards missions.
  if (track && auth && (await firstTime(`search:${auth.userId}:${q.toLowerCase()}:${dayKey()}`))) {
    bus.emit('radar.searched', { userId: auth.userId, query: q });
  }
  return { query: q, games, tournaments, resources: await toResources(docs) };
}

export async function latestNews(limit: number): Promise<ResourceDto[]> {
  const docs = await Resource.find({ status: 'published', kind: { $in: ['news', 'patch'] } })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .lean<ResourceDoc[]>();
  return toResources(docs);
}

export async function dealsEndingSoon(limit: number): Promise<ResourceDto[]> {
  const docs = await Resource.find({ status: 'published', kind: 'deal', expiresAt: { $gt: new Date() } })
    .sort({ expiresAt: 1 })
    .limit(limit)
    .lean<ResourceDoc[]>();
  return toResources(docs);
}

export async function upcomingEvents(limit: number): Promise<ResourceDto[]> {
  const now = new Date();
  const docs = await Resource.find({
    status: 'published',
    kind: 'event',
    $or: [{ expiresAt: { $gt: now } }, { expiresAt: null, startsAt: { $gt: now } }],
  })
    .sort({ startsAt: 1 })
    .limit(limit)
    .lean<ResourceDoc[]>();
  return toResources(docs);
}

export async function tickerItems(limit: number): Promise<ResourceDto[]> {
  const docs = await Resource.find({ $and: [{ status: 'published' }, activeClause(new Date())] })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .lean<ResourceDoc[]>();
  return toResources(docs);
}

export async function createResource(input: ResourceInput, createdBy: string): Promise<ResourceDto> {
  if (input.gameId && !(await gameExists(input.gameId))) throw AppError.unprocessable('Unknown game', { fields: { gameId: 'Unknown game' } });
  const doc = await Resource.create({
    ...input,
    titleLower: input.title.toLowerCase(),
    publishedAt: input.publishedAt ?? new Date(),
    createdBy,
  });
  const [resource] = await toResources([doc.toObject()]);
  return resource!;
}

export async function deleteResource(id: string): Promise<void> {
  const result = await Resource.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw AppError.notFound('Resource');
}

export interface IngestedResource {
  externalId: string;
  kind: Extract<ResourceKind, 'news' | 'patch' | 'deal'>;
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  gameId: Types.ObjectId | null;
  publishedAt: Date;
  imageUrl: string | null;
  deal: { store: string; price: number; originalPrice: number | null; currency: string } | null;
  expiresAt: Date | null;
}

/** Inserts a feed item once; later runs only add a picture that wasn't known before. */
export async function upsertIngestedResource(item: IngestedResource): Promise<boolean> {
  const result = await Resource.updateOne(
    { externalId: item.externalId },
    {
      $setOnInsert: {
        ...item,
        titleLower: item.title.toLowerCase(),
        // Tags make "patch notes" and "free" searchable.
        tags: item.kind === 'patch' ? ['patch-notes'] : item.deal?.price === 0 ? ['free'] : [],
        status: 'published',
      },
    },
    { upsert: true },
  );
  if (result.upsertedCount === 1) return true;
  if (item.imageUrl) await Resource.updateOne({ externalId: item.externalId, imageUrl: null }, { $set: { imageUrl: item.imageUrl } });
  return false;
}
