import { Router } from 'express';
import { alertPreferencesUpdateSchema, idParamsSchema, notificationQuerySchema } from '@tgh/shared';
import { requireAuth } from '../../core/auth/middleware';
import { handle } from '../../core/http/handler';
import { listInbox, markAllRead, markRead, unreadCount } from './inbox.service';
import { getPreferences, updatePreferences } from './preferences.service';

export const alertsRouter = Router();
alertsRouter.use(requireAuth);

alertsRouter.get(
  '/inbox',
  handle({ query: notificationQuerySchema }, ({ query, user }) => listInbox(user().userId, query)),
);

alertsRouter.get(
  '/unread-count',
  handle({}, async ({ user }) => ({ count: await unreadCount(user().userId) })),
);

alertsRouter.post(
  '/inbox/read-all',
  handle({}, ({ user }) => markAllRead(user().userId)),
);

alertsRouter.post(
  '/inbox/:id/read',
  handle({ params: idParamsSchema }, async ({ params, user }) => {
    await markRead(user().userId, params.id);
  }),
);

alertsRouter.get('/preferences', handle({}, ({ user }) => getPreferences(user().userId)));

alertsRouter.patch(
  '/preferences',
  handle({ body: alertPreferencesUpdateSchema }, ({ body, user }) => updatePreferences(user().userId, body)),
);
