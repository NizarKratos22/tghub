import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import webpush, { WebPushError } from 'web-push';
import type { PushConfig, PushSubscriptionInput } from '@tgh/shared';
import { env } from '../../config/env';
import { AppError } from '../../core/http/errors';
import { logger } from '../../core/logger';
import { Session, type SessionDoc } from '../auth/session.model';
import { PushSubscription, type PushSubscriptionDoc } from './push.model';

const MAX_DEVICES_PER_USER = 10;
const SEND_CONCURRENCY = 25;
const BODY_LIMIT = 180;

/**
 * Only real browser push services. The endpoint is a URL the server POSTs to,
 * so accepting any host would let a player point it at internal addresses.
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome, Android, Samsung Internet, Opera
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^web\.push\.apple\.com$/, // Safari, iOS home-screen apps
  /\.push\.apple\.com$/,
  /\.notify\.windows\.com$/, // Edge
];

export function isPushServiceUrl(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' && !url.port && PUSH_HOSTS.some((host) => host.test(url.hostname));
  } catch {
    return false;
  }
}

/* ── VAPID keys ── */

let keys: { publicKey: string; privateKey: string } | null | undefined;

/**
 * Production takes the key pair from the environment. Development generates
 * one on first use and keeps it under var/, so browser subscriptions survive
 * API restarts.
 */
function vapidKeys() {
  if (keys !== undefined) return keys;
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    keys = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  } else if (!env.isProduction) {
    const file = path.join(path.dirname(path.resolve(env.MEDIA_DIR)), 'vapid-dev.json');
    if (existsSync(file)) {
      keys = JSON.parse(readFileSync(file, 'utf8')) as { publicKey: string; privateKey: string };
    } else {
      keys = webpush.generateVAPIDKeys();
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, JSON.stringify(keys, null, 2));
      logger.info({ file }, 'Generated development VAPID keys for web push');
    }
  } else {
    keys = null;
    logger.warn('Web push is off: set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY');
  }
  if (keys) webpush.setVapidDetails(env.VAPID_SUBJECT, keys.publicKey, keys.privateKey);
  return keys;
}

export function pushConfig(): PushConfig {
  return { publicKey: vapidKeys()?.publicKey ?? null };
}

/* ── Subscriptions ── */

export async function subscribe(userId: string, sessionId: string, input: PushSubscriptionInput, userAgent: string): Promise<void> {
  if (!vapidKeys()) throw new AppError(503, 'PUSH_DISABLED', 'Notifications on this device are not available right now');
  if (!isPushServiceUrl(input.endpoint)) {
    throw AppError.unprocessable("This browser's push service isn't supported", { fields: { endpoint: 'Unsupported push service' } });
  }
  // A browser belongs to whoever is signed in on it now.
  await PushSubscription.updateOne(
    { endpoint: input.endpoint },
    { $set: { userId, sessionId, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent: userAgent.slice(0, 300) } },
    { upsert: true },
  );
  const extra = await PushSubscription.find({ userId }).sort({ createdAt: -1 }).skip(MAX_DEVICES_PER_USER).select('_id').lean();
  if (extra.length > 0) await PushSubscription.deleteMany({ _id: { $in: extra.map((doc) => doc._id) } });
}

export async function unsubscribe(userId: string, endpoint: string): Promise<void> {
  await PushSubscription.deleteOne({ userId, endpoint });
}

/* ── Sending ── */

export interface PushPayload {
  title: string;
  body: string;
  /** Opened on click; a path on this site. */
  url: string;
  /** Notifications with the same tag replace each other on the device. */
  tag: string;
}

export interface PushOptions {
  /** Seconds the push service keeps trying an offline device. */
  ttl?: number;
  urgency?: 'normal' | 'high';
}

async function deliver(subscription: PushSubscriptionDoc, body: string, options: PushOptions): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      body,
      { TTL: options.ttl ?? 86_400, urgency: options.urgency ?? 'normal', timeout: 10_000 },
    );
    return true;
  } catch (error) {
    // 404/410: the browser unsubscribed or the subscription expired.
    if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
      await PushSubscription.deleteOne({ _id: subscription._id });
    } else {
      logger.warn({ err: error, endpointHost: new URL(subscription.endpoint).hostname }, 'Push delivery failed');
    }
    return false;
  }
}

/** Sends to every device of these players whose session is still signed in. */
export async function sendPush(userIds: string[], payload: PushPayload, options: PushOptions = {}): Promise<{ devices: number; sent: number }> {
  if (userIds.length === 0 || !vapidKeys()) return { devices: 0, sent: 0 };
  const subscriptions = await PushSubscription.find({ userId: { $in: userIds } }).lean<PushSubscriptionDoc[]>();
  if (subscriptions.length === 0) return { devices: 0, sent: 0 };

  const live = await Session.find({ _id: { $in: subscriptions.map((s) => s.sessionId) }, revokedAt: null, expiresAt: { $gt: new Date() } })
    .select('_id')
    .lean<Array<Pick<SessionDoc, '_id'>>>();
  const liveIds = new Set(live.map((session) => String(session._id)));
  const signedOut = subscriptions.filter((s) => !liveIds.has(String(s.sessionId)));
  if (signedOut.length > 0) await PushSubscription.deleteMany({ _id: { $in: signedOut.map((s) => s._id) } });
  const targets = subscriptions.filter((s) => liveIds.has(String(s.sessionId)));

  const body = JSON.stringify({ ...payload, body: payload.body.length > BODY_LIMIT ? `${payload.body.slice(0, BODY_LIMIT - 1)}…` : payload.body });
  let sent = 0;
  for (let i = 0; i < targets.length; i += SEND_CONCURRENCY) {
    const results = await Promise.all(targets.slice(i, i + SEND_CONCURRENCY).map((target) => deliver(target, body, options)));
    sent += results.filter(Boolean).length;
  }
  if (sent > 0) {
    await PushSubscription.updateMany({ _id: { $in: targets.map((t) => t._id) } }, { $set: { lastSentAt: new Date() } });
  }
  return { devices: targets.length, sent };
}
