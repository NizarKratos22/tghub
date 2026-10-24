import { Router } from 'express';
import {
  adminStatsQuerySchema,
  adminUserQuerySchema,
  adminUserUpdateSchema,
  deliveryLogQuerySchema,
  discordTargetInputSchema,
  discordTargetUpdateSchema,
  gameInputSchema,
  gameUpdateSchema,
  idParamsSchema,
  sellerVerificationSchema,
  missionUpdateSchema,
  publishAlertSchema,
  resourceInputSchema,
  sourceInputSchema,
  sourceUpdateSchema,
} from '@tgh/shared';
import { requireRole } from '../../core/auth/middleware';
import { handle } from '../../core/http/handler';
import {
  adminPublish,
  createDiscordTarget,
  deleteDiscordTarget,
  listAlerts,
  listDeliveryLogs,
  listDiscordTargets,
  sendTestAlert,
  testDiscordTarget,
  updateDiscordTarget,
} from '../alerts/alerts.service';
import { createSource, deleteSource, listSources, runSource, updateSource } from '../alerts/sources/sources.service';
import { createGame, updateGame } from '../games/games.service';
import { adminListMissions, adminUpdateMission } from '../progression/progression.service';
import { createResource, deleteResource } from '../radar/radar.service';
import { adminClearProfileImages, adminListUsers, adminUpdateUser } from '../users/users.service';
import { setSellerOverride } from '../market/reputation.service';
import { adminPayments } from '../payments/payments.service';
import { overview, stats } from './admin.service';

export const adminRouter = Router();
adminRouter.use(requireRole('admin'));

adminRouter.get('/overview', handle({}, () => overview()));
adminRouter.get('/stats', handle({ query: adminStatsQuerySchema }, ({ query }) => stats(query.days)));

/* Users */
adminRouter.get('/users', handle({ query: adminUserQuerySchema }, ({ query }) => adminListUsers(query)));
adminRouter.get('/payments', handle({}, () => adminPayments()));
adminRouter.put(
  '/users/:id/seller-verification',
  handle({ params: idParamsSchema, body: sellerVerificationSchema }, async ({ params, body }) => {
    await setSellerOverride(params.id, body.override);
  }),
);
adminRouter.delete('/users/:id/images', handle({ params: idParamsSchema }, ({ params }) => adminClearProfileImages(params.id)));
adminRouter.patch(
  '/users/:id',
  handle({ params: idParamsSchema, body: adminUserUpdateSchema }, ({ params, body, user }) =>
    adminUpdateUser(user().userId, params.id, body),
  ),
);

/* Catalogue & Radar content */
adminRouter.post('/games', handle({ body: gameInputSchema, status: 201 }, ({ body }) => createGame(body)));
adminRouter.patch(
  '/games/:id',
  handle({ params: idParamsSchema, body: gameUpdateSchema }, ({ params, body }) => updateGame(params.id, body)),
);
adminRouter.post(
  '/resources',
  handle({ body: resourceInputSchema, status: 201 }, ({ body, user }) => createResource(body, user().userId)),
);
adminRouter.delete(
  '/resources/:id',
  handle({ params: idParamsSchema }, async ({ params }) => {
    await deleteResource(params.id);
  }),
);

/* Missions & rewards */
adminRouter.get('/missions', handle({}, () => adminListMissions()));
adminRouter.patch(
  '/missions/:id',
  handle({ params: idParamsSchema, body: missionUpdateSchema }, ({ params, body }) => adminUpdateMission(params.id, body)),
);

/* Alerts */
adminRouter.get('/alerts', handle({}, () => listAlerts()));
adminRouter.post(
  '/alerts',
  handle({ body: publishAlertSchema, status: 201 }, ({ body, user }) => adminPublish(body, user().userId)),
);
adminRouter.post('/alerts/test', handle({}, ({ user }) => sendTestAlert(user().userId)));
adminRouter.get(
  '/delivery-logs',
  handle({ query: deliveryLogQuerySchema }, ({ query }) => listDeliveryLogs(query.alertId, query.limit)),
);

/* Alert sources */
adminRouter.get('/sources', handle({}, () => listSources()));
adminRouter.post('/sources', handle({ body: sourceInputSchema, status: 201 }, ({ body }) => createSource(body)));
adminRouter.patch(
  '/sources/:id',
  handle({ params: idParamsSchema, body: sourceUpdateSchema }, ({ params, body }) => updateSource(params.id, body)),
);
adminRouter.delete(
  '/sources/:id',
  handle({ params: idParamsSchema }, async ({ params }) => {
    await deleteSource(params.id);
  }),
);
adminRouter.post('/sources/:id/run', handle({ params: idParamsSchema }, ({ params }) => runSource(params.id)));

/* Discord */
adminRouter.get('/discord-targets', handle({}, () => listDiscordTargets()));
adminRouter.post(
  '/discord-targets',
  handle({ body: discordTargetInputSchema, status: 201 }, ({ body }) => createDiscordTarget(body)),
);
adminRouter.patch(
  '/discord-targets/:id',
  handle({ params: idParamsSchema, body: discordTargetUpdateSchema }, ({ params, body }) =>
    updateDiscordTarget(params.id, body),
  ),
);
adminRouter.delete(
  '/discord-targets/:id',
  handle({ params: idParamsSchema }, async ({ params }) => {
    await deleteDiscordTarget(params.id);
  }),
);
adminRouter.post(
  '/discord-targets/:id/test',
  handle({ params: idParamsSchema }, ({ params }) => testDiscordTarget(params.id)),
);
