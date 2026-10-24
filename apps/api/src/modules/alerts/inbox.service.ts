import type { QueryFilter } from 'mongoose';
import type { CursorPage, Notification as NotificationDto, NotificationQuery } from '@tgh/shared';
import { toObjectId } from '../../core/http/utils';
import { gameRefMap } from '../games/games.service';
import { toNotificationDto } from './alerts.mapper';
import { Notification, type NotificationDoc } from './alerts.model';

export async function listInbox(userId: string, query: NotificationQuery): Promise<CursorPage<NotificationDto>> {
  const filter: QueryFilter<NotificationDoc> = { userId };
  if (query.status === 'unread') filter.readAt = null;
  if (query.category) filter.category = query.category;
  if (query.before) filter._id = { $lt: toObjectId(query.before) };

  // Fetch one extra row to know whether another page exists.
  const docs = await Notification.find(filter).sort({ _id: -1 }).limit(query.limit + 1).lean<NotificationDoc[]>();
  const items = docs.slice(0, query.limit);
  const games = await gameRefMap(items.map((doc) => doc.gameId));

  return {
    items: items.map((doc) => toNotificationDto(doc, games)),
    nextCursor: docs.length > query.limit ? String(items.at(-1)!._id) : null,
  };
}

export function unreadCount(userId: string): Promise<number> {
  return Notification.countDocuments({ userId, readAt: null });
}

export async function markRead(userId: string, notificationId: string): Promise<void> {
  await Notification.updateOne({ _id: notificationId, userId, readAt: null }, { $set: { readAt: new Date() } });
}

export async function markAllRead(userId: string): Promise<{ updated: number }> {
  const result = await Notification.updateMany({ userId, readAt: null }, { $set: { readAt: new Date() } });
  return { updated: result.modifiedCount };
}
