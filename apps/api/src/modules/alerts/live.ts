import type { Types } from 'mongoose';
import { publishSafely, realtime } from '../../core/realtime/hub';
import { gameRefMap } from '../games/games.service';
import { toNotificationDto } from './alerts.mapper';
import type { AlertDoc, NotificationDoc } from './alerts.model';
import { unreadCount } from './inbox.service';

/**
 * Pushes freshly written inbox rows to players who are on the site right now,
 * so the bell updates and a toast appears without waiting for a poll.
 */
export async function announceNotifications(alert: AlertDoc, rows: Array<{ id: Types.ObjectId; userId: Types.ObjectId; createdAt: Date }>): Promise<void> {
  const online = rows.filter((row) => realtime.isOnline(String(row.userId)));
  if (online.length === 0) return;
  const games = await gameRefMap([alert.gameId]);
  for (const row of online) {
    const userId = String(row.userId);
    const doc: NotificationDoc = {
      _id: row.id,
      userId: row.userId,
      alertId: alert._id,
      category: alert.category,
      title: alert.title,
      summary: alert.summary,
      url: alert.url,
      sourceName: alert.sourceName,
      gameId: alert.gameId,
      publishedAt: alert.publishedAt,
      readAt: null,
      createdAt: row.createdAt,
    };
    publishSafely(userId, { type: 'notification', data: { notification: toNotificationDto(doc, games), unreadCount: await unreadCount(userId) } });
  }
}

/** Where a tap on the phone notification lands: the link itself if it's ours, the inbox otherwise. */
export function pushTarget(url: string | null): string {
  return url?.startsWith('/') && !url.startsWith('//') ? url : '/alerts';
}
