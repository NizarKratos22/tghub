import { setTimeout as sleep } from 'node:timers/promises';
import { ALERT_CATEGORY_META } from '@tgh/shared';
import { DiscordTarget, type AlertDoc, type DiscordTargetDoc } from '../alerts.model';
import type { AlertChannel } from './channel';

const BRAND_RED = 0xe10600;
const MAX_ATTEMPTS = 3;

interface DiscordPayload {
  username: string;
  allowed_mentions: { parse: string[] };
  embeds: Array<{
    title: string;
    description?: string;
    url?: string;
    color: number;
    timestamp: string;
    footer: { text: string };
  }>;
}

export function buildDiscordPayload(alert: Pick<AlertDoc, 'title' | 'summary' | 'url' | 'category' | 'sourceName' | 'publishedAt'>): DiscordPayload {
  const absoluteUrl = alert.url?.startsWith('http') ? alert.url : undefined;
  return {
    username: 'TG Hub Alerts',
    // Never let an alert ping @everyone, roles or users.
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: alert.title.slice(0, 256),
        ...(alert.summary ? { description: alert.summary.slice(0, 2000) } : {}),
        ...(absoluteUrl ? { url: absoluteUrl } : {}),
        color: BRAND_RED,
        timestamp: alert.publishedAt.toISOString(),
        footer: { text: `${ALERT_CATEGORY_META[alert.category].label} · ${alert.sourceName}`.slice(0, 2048) },
      },
    ],
  };
}

/** Posts to a webhook, honouring Discord's 429 `retry_after`. */
export async function postToWebhook(webhookUrl: string, payload: DiscordPayload): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${webhookUrl}?wait=true`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) return;
    if (response.status === 429 && attempt < MAX_ATTEMPTS) {
      const body = (await response.json().catch(() => ({}))) as { retry_after?: number };
      await sleep(Math.min((body.retry_after ?? 1) * 1000, 10_000));
      continue;
    }
    throw new Error(`Discord responded ${response.status}`);
  }
}

export const discordChannel: AlertChannel = {
  name: 'discord',
  async deliver(alert) {
    // Personal alerts (level-ups, invites) stay private.
    if (alert.recipients.length > 0) return null;

    const targets = await DiscordTarget.find({ enabled: true, categories: alert.category })
      .select('+webhookUrl')
      .lean<DiscordTargetDoc[]>();
    if (targets.length === 0) return null;

    const payload = buildDiscordPayload(alert);
    let sent = 0;
    const failures: string[] = [];

    for (const target of targets) {
      try {
        await postToWebhook(target.webhookUrl, payload);
        sent += 1;
        await DiscordTarget.updateOne({ _id: target._id }, { $set: { lastDeliveredAt: new Date(), lastError: null } });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        failures.push(`${target.name}: ${message}`);
        await DiscordTarget.updateOne({ _id: target._id }, { $set: { lastError: message } });
      }
    }

    return {
      status: sent > 0 ? 'sent' : 'failed',
      recipients: sent,
      detail: failures.length > 0 ? failures.join('; ').slice(0, 500) : null,
    };
  },
};
