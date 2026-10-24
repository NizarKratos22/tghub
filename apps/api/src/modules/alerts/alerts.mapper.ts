import type {
  AdminAlert,
  AlertSource as AlertSourceDto,
  DeliveryLog as DeliveryLogDto,
  DiscordTarget as DiscordTargetDto,
  GameRef,
  Notification as NotificationDto,
} from '@tgh/shared';
import { iso } from '../../core/http/utils';
import { healthOf } from '../../core/ingest/source-health';
import type { AlertDoc, AlertSourceDoc, DeliveryLogDoc, DiscordTargetDoc, NotificationDoc } from './alerts.model';

const gameFrom = (games: Map<string, GameRef>, id: unknown) => (id ? (games.get(String(id)) ?? null) : null);

export function toNotificationDto(doc: NotificationDoc, games: Map<string, GameRef>): NotificationDto {
  return {
    id: String(doc._id),
    category: doc.category,
    title: doc.title,
    summary: doc.summary,
    url: doc.url,
    sourceName: doc.sourceName,
    game: gameFrom(games, doc.gameId),
    publishedAt: doc.publishedAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    readAt: iso(doc.readAt),
  };
}

export function toAdminAlert(doc: AlertDoc, games: Map<string, GameRef>): AdminAlert {
  return {
    id: String(doc._id),
    category: doc.category,
    title: doc.title,
    summary: doc.summary,
    url: doc.url,
    sourceName: doc.sourceName,
    dedupKey: doc.dedupKey,
    game: gameFrom(games, doc.gameId),
    targeted: doc.recipients.length > 0,
    publishedAt: doc.publishedAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

export function toDeliveryLogDto(doc: DeliveryLogDoc): DeliveryLogDto {
  return {
    id: String(doc._id),
    alertId: String(doc.alertId),
    alertTitle: doc.alertTitle,
    channel: doc.channel,
    status: doc.status,
    recipients: doc.recipients,
    detail: doc.detail,
    createdAt: doc.createdAt.toISOString(),
  };
}

export function toSourceDto(doc: AlertSourceDoc, games: Map<string, GameRef>): AlertSourceDto {
  return {
    id: String(doc._id),
    name: doc.name,
    adapter: doc.adapter,
    config: { appId: doc.config.appId },
    game: gameFrom(games, doc.gameId),
    category: doc.category,
    enabled: doc.enabled,
    intervalMinutes: doc.intervalMinutes,
    health: healthOf(doc),
    lastRunAt: iso(doc.lastRunAt),
    lastSuccessAt: iso(doc.lastSuccessAt),
    lastError: doc.lastError,
    consecutiveFailures: doc.consecutiveFailures,
    itemsIngested: doc.itemsIngested,
  };
}

export function toDiscordTargetDto(doc: DiscordTargetDoc): DiscordTargetDto {
  return {
    id: String(doc._id),
    name: doc.name,
    webhookHint: doc.webhookHint,
    categories: doc.categories,
    enabled: doc.enabled,
    lastDeliveredAt: iso(doc.lastDeliveredAt),
    lastError: doc.lastError,
  };
}
