import { Router } from 'express';
import { idParamsSchema } from '@tgh/shared';
import { requireAuth } from '../../core/auth/middleware';
import { handle } from '../../core/http/handler';
import {
  claimMission,
  countryStandings,
  currentPulse,
  leaderboard,
  listAchievements,
  listMissions,
  regionStandings,
  snapshot,
  xpHistory,
} from './progression.service';

export const universeRouter = Router();

// Public: the community side of the Universe.
universeRouter.get('/pulse', handle({}, () => currentPulse()));
universeRouter.get('/leaderboard', handle({}, () => leaderboard(25)));
universeRouter.get('/regions', handle({}, () => regionStandings()));
universeRouter.get('/countries', handle({}, () => countryStandings()));
universeRouter.get('/achievements', handle({}, ({ auth }) => listAchievements(auth?.userId ?? null)));

// Personal progress.
universeRouter.get('/me', requireAuth, handle({}, ({ user }) => snapshot(user().userId)));
universeRouter.get('/missions', requireAuth, handle({}, ({ user }) => listMissions(user().userId)));
universeRouter.get('/xp-history', requireAuth, handle({}, ({ user }) => xpHistory(user().userId)));

universeRouter.post(
  '/missions/:id/claim',
  requireAuth,
  handle({ params: idParamsSchema }, ({ params, user }) => claimMission(user().userId, params.id)),
);
