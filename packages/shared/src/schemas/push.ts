import { z } from 'zod';

const base64url = z.string().trim().regex(/^[A-Za-z0-9_-]+=*$/, 'Invalid key');

/** A browser PushSubscription, as `subscription.toJSON()` returns it. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({
    p256dh: base64url.max(200),
    auth: base64url.max(100),
  }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export const pushUnsubscribeSchema = z.object({ endpoint: z.url({ protocol: /^https$/ }).max(1000) });
