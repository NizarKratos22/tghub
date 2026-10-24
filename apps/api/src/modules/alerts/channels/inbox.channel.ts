import type { AnyBulkWriteOperation, QueryFilter, Types } from 'mongoose';
import { startOfLocalDay } from '../../../core/time/periods';
import { AlertPreference, Notification, type AlertDoc, type AlertPreferenceDoc, type NotificationDoc } from '../alerts.model';
import { announceNotifications } from '../live';
import type { AlertChannel } from './channel';

const BATCH_SIZE = 500;

type Subscriber = Pick<AlertPreferenceDoc, 'userId' | 'maxPerDay'>;

function audienceFilter(alert: AlertDoc): QueryFilter<AlertPreferenceDoc> {
  const filter: QueryFilter<AlertPreferenceDoc> = { [`categories.${alert.category}`]: { $ne: false } };
  if (alert.recipients.length > 0) {
    filter.userId = { $in: alert.recipients };
  } else if (alert.audience === 'game_followers' && alert.gameId) {
    filter.$or = [{ followAllGames: true }, { followedGameIds: alert.gameId }];
  }
  return filter;
}

/** Drops subscribers who already hit their daily cap of broadcast alerts. */
async function withinDailyCap(subscribers: Subscriber[]): Promise<Subscriber[]> {
  const counts = await Notification.aggregate<{ _id: Types.ObjectId; n: number }>([
    {
      $match: {
        userId: { $in: subscribers.map((s) => s.userId) },
        createdAt: { $gte: startOfLocalDay() },
        category: { $ne: 'social' },
      },
    },
    { $group: { _id: '$userId', n: { $sum: 1 } } },
  ]);
  const sentToday = new Map(counts.map((row) => [String(row._id), row.n]));
  return subscribers.filter((s) => (sentToday.get(String(s.userId)) ?? 0) < s.maxPerDay);
}

async function writeBatch(alert: AlertDoc, subscribers: Subscriber[], personal: boolean) {
  const eligible = personal ? subscribers : await withinDailyCap(subscribers);
  if (eligible.length === 0) return { sent: 0, capped: subscribers.length };

  // Upserts keyed on (user, alert): re-dispatching an alert never duplicates inbox rows.
  const createdAt = new Date();
  const operations: AnyBulkWriteOperation<NotificationDoc>[] = eligible.map((subscriber) => ({
    updateOne: {
      filter: { userId: subscriber.userId, alertId: alert._id },
      update: {
        $setOnInsert: {
          userId: subscriber.userId,
          alertId: alert._id,
          category: alert.category,
          title: alert.title,
          summary: alert.summary,
          url: alert.url,
          sourceName: alert.sourceName,
          gameId: alert.gameId,
          publishedAt: alert.publishedAt,
          readAt: null,
          createdAt,
        },
      },
      upsert: true,
    },
  }));
  const result = await Notification.bulkWrite(operations, { ordered: false });
  const inserted = Object.entries(result.upsertedIds).map(([index, id]) => ({ id: id as Types.ObjectId, userId: eligible[Number(index)]!.userId, createdAt }));
  await announceNotifications(alert, inserted);
  return { sent: result.upsertedCount, capped: subscribers.length - eligible.length };
}

export const inboxChannel: AlertChannel = {
  name: 'inbox',
  async deliver(alert) {
    const personal = alert.recipients.length > 0;
    let sent = 0;
    let capped = 0;
    let batch: Subscriber[] = [];

    const flush = async () => {
      const result = await writeBatch(alert, batch, personal);
      sent += result.sent;
      capped += result.capped;
      batch = [];
    };

    const cursor = AlertPreference.find(audienceFilter(alert)).select('userId maxPerDay').lean<Subscriber[]>().cursor();
    for await (const subscriber of cursor) {
      batch.push(subscriber as Subscriber);
      if (batch.length >= BATCH_SIZE) await flush();
    }
    if (batch.length > 0) await flush();

    if (sent === 0) {
      return { status: 'skipped', recipients: 0, detail: capped > 0 ? `All ${capped} matching players hit their daily cap` : 'No players matched this alert' };
    }
    return { status: 'sent', recipients: sent, detail: capped > 0 ? `${capped} skipped by daily cap` : null };
  },
};
