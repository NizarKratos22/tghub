import { model, Schema, type Types } from 'mongoose';
import {
  ALERT_AUDIENCES,
  ALERT_CATEGORIES,
  ALERT_CHANNELS,
  SOURCE_ADAPTERS,
  type AlertAudience,
  type AlertCategory,
  type AlertChannelName,
  type SourceAdapterName,
} from '@tgh/shared';

/* ── Alert: the canonical announcement, stored once no matter how many sources repeat it. ── */

export interface AlertDoc {
  _id: Types.ObjectId;
  category: AlertCategory;
  title: string;
  summary: string;
  url: string | null;
  sourceName: string;
  dedupKey: string;
  gameId: Types.ObjectId | null;
  /** Broadcasts only: everyone with the category on, or only followers of `gameId`. */
  audience: AlertAudience;
  /** Set for personal alerts (level-ups, invites). Empty = broadcast by preferences. */
  recipients: Types.ObjectId[];
  sourceId: Types.ObjectId | null;
  createdBy: Types.ObjectId | null;
  publishedAt: Date;
  createdAt: Date;
}

const alertSchema = new Schema<AlertDoc>(
  {
    category: { type: String, enum: ALERT_CATEGORIES, required: true },
    title: { type: String, required: true },
    summary: { type: String, default: '' },
    url: { type: String, default: null },
    sourceName: { type: String, required: true },
    dedupKey: { type: String, required: true, unique: true },
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', default: null },
    audience: { type: String, enum: ALERT_AUDIENCES, default: 'everyone' },
    recipients: { type: [Schema.Types.ObjectId], default: [] },
    sourceId: { type: Schema.Types.ObjectId, ref: 'AlertSource', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    publishedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
alertSchema.index({ createdAt: -1 });

export const Alert = model<AlertDoc>('Alert', alertSchema);

/* ── Notification: one inbox row per (user, alert). Denormalised for fast reads. ── */

export interface NotificationDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  alertId: Types.ObjectId;
  category: AlertCategory;
  title: string;
  summary: string;
  url: string | null;
  sourceName: string;
  gameId: Types.ObjectId | null;
  publishedAt: Date;
  readAt: Date | null;
  createdAt: Date;
}

const notificationSchema = new Schema<NotificationDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    alertId: { type: Schema.Types.ObjectId, ref: 'Alert', required: true },
    category: { type: String, enum: ALERT_CATEGORIES, required: true },
    title: { type: String, required: true },
    summary: { type: String, default: '' },
    url: { type: String, default: null },
    sourceName: { type: String, required: true },
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', default: null },
    publishedAt: { type: Date, required: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
notificationSchema.index({ userId: 1, alertId: 1 }, { unique: true });
notificationSchema.index({ userId: 1, _id: -1 });
notificationSchema.index({ userId: 1, readAt: 1 });
notificationSchema.index({ userId: 1, category: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const Notification = model<NotificationDoc>('Notification', notificationSchema);

/* ── Preferences ── */

export interface AlertPreferenceDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  categories: Record<AlertCategory, boolean>;
  followedGameIds: Types.ObjectId[];
  followAllGames: boolean;
  /** Daily ceiling for broadcast alerts (personal alerts are never capped). */
  maxPerDay: number;
  updatedAt: Date;
}

const categoryFlags = Object.fromEntries(
  ALERT_CATEGORIES.map((category) => [category, { type: Boolean, default: true }]),
);

const alertPreferenceSchema = new Schema<AlertPreferenceDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    categories: categoryFlags,
    followedGameIds: { type: [Schema.Types.ObjectId], default: [] },
    followAllGames: { type: Boolean, default: false },
    maxPerDay: { type: Number, default: 15 },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);
alertPreferenceSchema.index({ followedGameIds: 1 });

export const AlertPreference = model<AlertPreferenceDoc>('AlertPreference', alertPreferenceSchema, 'alert_preferences');

/* ── Delivery log: what each channel did with each alert. ── */

export interface DeliveryLogDoc {
  _id: Types.ObjectId;
  alertId: Types.ObjectId;
  alertTitle: string;
  channel: AlertChannelName;
  status: 'sent' | 'skipped' | 'failed';
  recipients: number;
  detail: string | null;
  createdAt: Date;
}

const deliveryLogSchema = new Schema<DeliveryLogDoc>(
  {
    alertId: { type: Schema.Types.ObjectId, ref: 'Alert', required: true },
    alertTitle: { type: String, required: true },
    channel: { type: String, enum: ALERT_CHANNELS, required: true },
    status: { type: String, enum: ['sent', 'skipped', 'failed'], required: true },
    recipients: { type: Number, default: 0 },
    detail: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
deliveryLogSchema.index({ createdAt: -1 });
deliveryLogSchema.index({ alertId: 1 });

export const DeliveryLog = model<DeliveryLogDoc>('DeliveryLog', deliveryLogSchema, 'delivery_logs');

/* ── Sources: where automatic alerts come from, with health tracking. ── */

export interface AlertSourceDoc {
  _id: Types.ObjectId;
  name: string;
  adapter: SourceAdapterName;
  config: { appId: number };
  gameId: Types.ObjectId | null;
  category: AlertCategory;
  enabled: boolean;
  intervalMinutes: number;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
  consecutiveFailures: number;
  itemsIngested: number;
  createdAt: Date;
  updatedAt: Date;
}

const alertSourceSchema = new Schema<AlertSourceDoc>(
  {
    name: { type: String, required: true },
    adapter: { type: String, enum: SOURCE_ADAPTERS, required: true },
    config: { appId: { type: Number, required: true } },
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', default: null },
    category: { type: String, enum: ALERT_CATEGORIES, default: 'game_update' },
    enabled: { type: Boolean, default: true },
    intervalMinutes: { type: Number, default: 60 },
    lastRunAt: { type: Date, default: null },
    lastSuccessAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    consecutiveFailures: { type: Number, default: 0 },
    itemsIngested: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const AlertSource = model<AlertSourceDoc>('AlertSource', alertSourceSchema, 'alert_sources');

/* ── Discord: channel webhooks that receive selected categories. ── */

export interface DiscordTargetDoc {
  _id: Types.ObjectId;
  name: string;
  webhookUrl: string;
  /** Last characters of the webhook token, safe to display. */
  webhookHint: string;
  categories: AlertCategory[];
  enabled: boolean;
  lastDeliveredAt: Date | null;
  lastError: string | null;
  createdAt: Date;
}

const discordTargetSchema = new Schema<DiscordTargetDoc>(
  {
    name: { type: String, required: true },
    webhookUrl: { type: String, required: true, select: false },
    webhookHint: { type: String, required: true },
    categories: { type: [String], enum: ALERT_CATEGORIES, default: [] },
    enabled: { type: Boolean, default: true },
    lastDeliveredAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const DiscordTarget = model<DiscordTargetDoc>('DiscordTarget', discordTargetSchema, 'discord_targets');
