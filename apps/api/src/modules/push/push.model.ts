import { model, Schema, type Types } from 'mongoose';

/**
 * A browser that agreed to receive notifications. Tied to the session that
 * subscribed it, so signing out (or "sign out other devices") also stops
 * notifications reaching that device.
 */
export interface PushSubscriptionDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  sessionId: Types.ObjectId;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
  lastSentAt: Date | null;
  createdAt: Date;
}

const pushSubscriptionSchema = new Schema<PushSubscriptionDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
    endpoint: { type: String, required: true, unique: true },
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
    userAgent: { type: String, default: '' },
    lastSentAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const PushSubscription = model<PushSubscriptionDoc>('PushSubscription', pushSubscriptionSchema, 'push_subscriptions');
