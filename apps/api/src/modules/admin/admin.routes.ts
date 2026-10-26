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
  igdbImportSchema,
  igdbLinkSchema,
  igdbSearchQuerySchema,
  sellerVerificationSchema,
  achievementInputSchema,
  missionCreateSchema,
  missionUpdateSchema,
  seasonInputSchema,
  seasonKeyParamsSchema,
  xpAdjustSchema,
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
import { importIgdbGame, linkIgdbGame, listAdminGames, searchIgdb, syncIgdbCatalogue, withIgdbErrors } from '../games/games.igdb';
import { createGame, updateGame } from '../games/games.service';
import {
  adminAdjustXp,
  adminCreateAchievement,
  adminCreateMission,
  adminCreateSeason,
  adminDeleteAchievement,
  adminDeleteMission,
  adminListAchievements,
  adminListSeasons,
  adminListXpAdjustments,
  adminUpdateAchievement,
  adminUpdateSeason,
} from '../progression/progression.admin';
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
adminRouter.get('/games', handle({}, () => listAdminGames()));
adminRouter.post('/games', handle({ body: gameInputSchema, status: 201 }, ({ body }) => createGame(body)));
/* Game data from IGDB: search, import a new game, re-link one, refresh everything now. */
adminRouter.get('/igdb/search', handle({ query: igdbSearchQuerySchema }, ({ query }) => withIgdbErrors(() => searchIgdb(query.q))));
adminRouter.post('/igdb/import', handle({ body: igdbImportSchema, status: 201 }, ({ body }) => withIgdbErrors(() => importIgdbGame(body.igdbId))));
adminRouter.post('/igdb/sync', handle({}, () => withIgdbErrors(() => syncIgdbCatalogue({ force: true }))));
adminRouter.put(
  '/games/:id/igdb',
  handle({ params: idParamsSchema, body: igdbLinkSchema }, ({ params, body }) => withIgdbErrors(() => linkIgdbGame(params.id, body.igdbId))),
);
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
adminRouter.post('/missions', handle({ body: missionCreateSchema, status: 201 }, ({ body }) => adminCreateMission(body)));
adminRouter.delete('/missions/:id', handle({ params: idParamsSchema }, ({ params }) => adminDeleteMission(params.id)));

adminRouter.get('/achievements', handle({}, () => adminListAchievements()));
adminRouter.post('/achievements', handle({ body: achievementInputSchema, status: 201 }, ({ body }) => adminCreateAchievement(body)));
adminRouter.put(
  '/achievements/:id',
  handle({ params: idParamsSchema, body: achievementInputSchema }, ({ params, body }) => adminUpdateAchievement(params.id, body)),
);
adminRouter.delete('/achievements/:id', handle({ params: idParamsSchema }, ({ params }) => adminDeleteAchievement(params.id)));

adminRouter.get('/seasons', handle({}, () => adminListSeasons()));
adminRouter.post('/seasons', handle({ body: seasonInputSchema, status: 201 }, ({ body }) => adminCreateSeason(body)));
adminRouter.put('/seasons/:key', handle({ params: seasonKeyParamsSchema, body: seasonInputSchema }, ({ params, body }) => adminUpdateSeason(params.key, body)));

/* XP adjustments: every one is recorded with the admin who made it. */
adminRouter.get('/xp', handle({}, () => adminListXpAdjustments()));
adminRouter.post('/xp', handle({ body: xpAdjustSchema, status: 201 }, ({ body, user }) => adminAdjustXp(body, user().userId)));

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
