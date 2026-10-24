import type { BookmarkTarget, GameSummary } from '@tgh/shared';
import { bus } from '../../core/events/bus';
import { AppError, isDuplicateKeyError } from '../../core/http/errors';
import { toObjectId } from '../../core/http/utils';
import { dayKey } from '../../core/time/periods';
import { Game } from '../games/game.model';
import { gameSummariesByIds } from '../games/games.service';
import { Listing } from '../market/market.model';
import { Resource } from '../radar/resource.model';
import { Bookmark, RecentView } from './library.model';

const TARGET_LABELS: Record<BookmarkTarget, string> = { game: 'Game', resource: 'Resource', listing: 'Listing' };

async function assertTargetExists(targetType: BookmarkTarget, targetId: string) {
  const exists =
    targetType === 'game'
      ? await Game.exists({ _id: targetId })
      : targetType === 'listing'
        ? await Listing.exists({ _id: targetId, status: { $in: ['active', 'pending', 'sold'] } })
        : await Resource.exists({ _id: targetId });
  if (!exists) throw AppError.notFound(TARGET_LABELS[targetType]);
}

export async function addBookmark(userId: string, targetType: BookmarkTarget, targetId: string): Promise<void> {
  await assertTargetExists(targetType, targetId);
  try {
    await Bookmark.create({ userId, targetType, targetId });
  } catch (error) {
    if (isDuplicateKeyError(error)) return; // already a favourite — idempotent
    throw error;
  }
  if (targetType === 'game') bus.emit('game.favorited', { userId, gameId: targetId });
}

export async function removeBookmark(userId: string, targetType: BookmarkTarget, targetId: string): Promise<void> {
  await Bookmark.deleteOne({ userId, targetType, targetId });
}

export async function bookmarkIds(userId: string, targetType: BookmarkTarget): Promise<string[]> {
  const rows = await Bookmark.find({ userId, targetType }).sort({ createdAt: -1 }).select('targetId').lean();
  return rows.map((row) => String(row.targetId));
}

export async function favoriteGames(userId: string, limit = 50): Promise<GameSummary[]> {
  const ids = (await bookmarkIds(userId, 'game')).slice(0, limit);
  return gameSummariesByIds(ids);
}

/**
 * Upserts the view and reports whether it is the first view of this target
 * today — missions count unique daily views, so refreshing a page can't farm XP.
 */
export async function recordView(userId: string, targetType: BookmarkTarget, targetId: string): Promise<boolean> {
  const today = dayKey();
  const previous = await RecentView.findOneAndUpdate(
    { userId: toObjectId(userId), targetType, targetId: toObjectId(targetId) },
    { $set: { viewedAt: new Date(), viewDay: today } },
    { upsert: true, returnDocument: 'before' },
  ).lean();
  const firstToday = !previous || previous.viewDay !== today;
  if (firstToday && targetType === 'game') bus.emit('game.viewed', { userId, gameId: targetId });
  return firstToday;
}

export async function recentGames(userId: string, limit = 8): Promise<GameSummary[]> {
  const rows = await RecentView.find({ userId, targetType: 'game' }).sort({ viewedAt: -1 }).limit(limit).select('targetId').lean();
  return gameSummariesByIds(rows.map((row) => row.targetId));
}
