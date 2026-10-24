import { Router } from 'express';
import { gameListQuerySchema, slugParamsSchema } from '@tgh/shared';
import { requireAuth } from '../../core/auth/middleware';
import { handle } from '../../core/http/handler';
import { recordView } from '../library/library.service';
import { findGameBySlug, getGameDetail, listGames } from './games.service';

export const gamesRouter = Router();

gamesRouter.get(
  '/',
  handle({ query: gameListQuerySchema }, ({ query }) => listGames(query)),
);

gamesRouter.get(
  '/:slug',
  handle({ params: slugParamsSchema }, ({ params }) => getGameDetail(params.slug)),
);

/** Called by the game page for signed-in players; counts towards missions once per game per day. */
gamesRouter.post(
  '/:slug/view',
  requireAuth,
  handle({ params: slugParamsSchema }, async ({ params, user }) => {
    const game = await findGameBySlug(params.slug);
    const firstToday = await recordView(user().userId, 'game', String(game._id));
    return { firstToday };
  }),
);
