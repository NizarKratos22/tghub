import { Router } from 'express';
import { pushSubscriptionSchema, pushUnsubscribeSchema } from '@tgh/shared';
import { requireAuth } from '../../core/auth/middleware';
import { handle } from '../../core/http/handler';
import { pushConfig, subscribe, unsubscribe } from './push.service';

/** Mounted at /api/v1/push. */
export const pushRouter = Router();

pushRouter.get('/config', handle({}, () => pushConfig()));

pushRouter.post(
  '/subscriptions',
  requireAuth,
  handle({ body: pushSubscriptionSchema }, async ({ req, body, user }) => {
    const { userId, sessionId } = user();
    await subscribe(userId, sessionId, body, req.get('user-agent') ?? '');
  }),
);

pushRouter.delete(
  '/subscriptions',
  requireAuth,
  handle({ body: pushUnsubscribeSchema }, async ({ body, user }) => {
    await unsubscribe(user().userId, body.endpoint);
  }),
);
