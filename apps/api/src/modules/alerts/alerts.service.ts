import { createHash } from 'node:crypto';
import type { Types } from 'mongoose';
import type {
  AdminAlert,
  DeliveryLog as DeliveryLogDto,
  DiscordTarget as DiscordTargetDto,
  DiscordTargetInput,
  DiscordTargetUpdateInput,
  PublishAlertInput,
  PublishAlertResult,
} from '@tgh/shared';
import { AppError, isDuplicateKeyError } from '../../core/http/errors';
import { toObjectId } from '../../core/http/utils';
import { logger } from '../../core/logger';
import { gameExists, gameRefMap } from '../games/games.service';
import { toAdminAlert, toDeliveryLogDto, toDiscordTargetDto } from './alerts.mapper';
import { Alert, DeliveryLog, DiscordTarget, type AlertDoc, type DeliveryLogDoc, type DiscordTargetDoc } from './alerts.model';
import type { AlertChannel } from './channels/channel';
import { buildDiscordPayload, discordChannel, postToWebhook } from './channels/discord.channel';
import { inboxChannel } from './channels/inbox.channel';
import { pushChannel } from './channels/push.channel';

/** Push must follow inbox: it notifies exactly the players who got an inbox row. */
const channels: AlertChannel[] = [inboxChannel, pushChannel, discordChannel];

export interface PublishOptions {
  /** Personal alert for these users only. */
  recipients?: string[];
  sourceId?: Types.ObjectId | null;
  createdBy?: string | null;
  publishedAt?: Date;
}

export function defaultDedupKey(input: Pick<PublishAlertInput, 'category' | 'url' | 'title'>): string {
  const basis = `${input.category}|${(input.url ?? input.title).trim().toLowerCase()}`;
  return `auto:${createHash('sha256').update(basis).digest('hex').slice(0, 32)}`;
}

async function dispatch(alert: AlertDoc): Promise<DeliveryLogDoc[]> {
  const logs: DeliveryLogDoc[] = [];
  for (const channel of channels) {
    let outcome;
    try {
      outcome = await channel.deliver(alert);
    } catch (error) {
      logger.error({ err: error, channel: channel.name, alertId: String(alert._id) }, 'Alert delivery failed');
      outcome = { status: 'failed' as const, recipients: 0, detail: error instanceof Error ? error.message.slice(0, 300) : 'Unknown error' };
    }
    if (!outcome) continue;
    const log = await DeliveryLog.create({ alertId: alert._id, alertTitle: alert.title, channel: channel.name, ...outcome });
    logs.push(log.toObject());
  }
  return logs;
}

/**
 * Stores the alert once (unique dedupKey) and fans it out to every channel.
 * Publishing the same announcement again returns `duplicate: true` and sends nothing.
 */
export async function publishAlert(
  input: PublishAlertInput,
  options: PublishOptions = {},
): Promise<{ alert: AlertDoc; duplicate: boolean; deliveries: DeliveryLogDoc[] }> {
  const dedupKey = input.dedupKey ?? defaultDedupKey(input);
  const audience = input.audience ?? (input.category === 'game_update' && input.gameId ? 'game_followers' : 'everyone');

  let alert: AlertDoc;
  try {
    const created = await Alert.create({
      ...input,
      dedupKey,
      audience,
      recipients: (options.recipients ?? []).map(toObjectId),
      sourceId: options.sourceId ?? null,
      createdBy: options.createdBy ?? null,
      publishedAt: options.publishedAt ?? new Date(),
    });
    alert = created.toObject();
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const existing = await Alert.findOne({ dedupKey }).lean<AlertDoc>();
    return { alert: existing!, duplicate: true, deliveries: [] };
  }

  return { alert, duplicate: false, deliveries: await dispatch(alert) };
}

export async function adminPublish(input: PublishAlertInput, adminId: string): Promise<PublishAlertResult> {
  if (input.gameId && !(await gameExists(input.gameId))) {
    throw AppError.unprocessable('Unknown game', { fields: { gameId: 'Unknown game' } });
  }
  const result = await publishAlert(input, { createdBy: adminId });
  const games = await gameRefMap([result.alert.gameId]);
  return {
    alert: toAdminAlert(result.alert, games),
    duplicate: result.duplicate,
    deliveries: result.deliveries.map(toDeliveryLogDto),
  };
}

/** Sends a one-off personal alert to the admin to check the pipeline end-to-end. */
export async function sendTestAlert(adminId: string): Promise<PublishAlertResult> {
  const result = await publishAlert(
    {
      category: 'announcement',
      title: 'Test alert',
      summary: 'If you can read this in your inbox, alert delivery works.',
      url: null,
      gameId: null,
      sourceName: 'TG Hub Admin',
      dedupKey: `test:${adminId}:${Date.now()}`,
    },
    { recipients: [adminId], createdBy: adminId },
  );
  return { alert: toAdminAlert(result.alert, new Map()), duplicate: false, deliveries: result.deliveries.map(toDeliveryLogDto) };
}

export async function listAlerts(limit = 50): Promise<AdminAlert[]> {
  const docs = await Alert.find().sort({ createdAt: -1 }).limit(limit).lean<AlertDoc[]>();
  const games = await gameRefMap(docs.map((doc) => doc.gameId));
  return docs.map((doc) => toAdminAlert(doc, games));
}

export async function listDeliveryLogs(alertId: string | undefined, limit: number): Promise<DeliveryLogDto[]> {
  const docs = await DeliveryLog.find(alertId ? { alertId } : {}).sort({ createdAt: -1 }).limit(limit).lean<DeliveryLogDoc[]>();
  return docs.map(toDeliveryLogDto);
}

/* ───────────── Discord targets ───────────── */

export async function listDiscordTargets(): Promise<DiscordTargetDto[]> {
  const docs = await DiscordTarget.find().sort({ createdAt: -1 }).lean<DiscordTargetDoc[]>();
  return docs.map(toDiscordTargetDto);
}

export async function createDiscordTarget(input: DiscordTargetInput): Promise<DiscordTargetDto> {
  const doc = await DiscordTarget.create({ ...input, webhookHint: `…${input.webhookUrl.slice(-6)}` });
  return toDiscordTargetDto(doc.toObject());
}

export async function updateDiscordTarget(id: string, input: DiscordTargetUpdateInput): Promise<DiscordTargetDto> {
  const doc = await DiscordTarget.findByIdAndUpdate(id, { $set: input }, { returnDocument: 'after' }).lean<DiscordTargetDoc>();
  if (!doc) throw AppError.notFound('Discord target');
  return toDiscordTargetDto(doc);
}

export async function deleteDiscordTarget(id: string): Promise<void> {
  const result = await DiscordTarget.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw AppError.notFound('Discord target');
}

export async function testDiscordTarget(id: string): Promise<DiscordTargetDto> {
  const target = await DiscordTarget.findById(id).select('+webhookUrl').lean<DiscordTargetDoc>();
  if (!target) throw AppError.notFound('Discord target');
  try {
    await postToWebhook(
      target.webhookUrl,
      buildDiscordPayload({
        title: 'TG Hub test alert',
        summary: `This channel will receive: ${target.categories.join(', ')}.`,
        url: null,
        category: 'announcement',
        sourceName: 'TG Hub Admin',
        publishedAt: new Date(),
      }),
    );
    await DiscordTarget.updateOne({ _id: id }, { $set: { lastDeliveredAt: new Date(), lastError: null } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await DiscordTarget.updateOne({ _id: id }, { $set: { lastError: message } });
    throw AppError.unprocessable(`Discord rejected the test: ${message}`);
  }
  const updated = await DiscordTarget.findById(id).lean<DiscordTargetDoc>();
  return toDiscordTargetDto(updated!);
}
