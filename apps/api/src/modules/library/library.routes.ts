import { Router } from 'express';
import { bookmarkInputSchema, bookmarkListQuerySchema, bookmarkParamsSchema } from '@tgh/shared';
import { requireAuth } from '../../core/auth/middleware';
import { handle } from '../../core/http/handler';
import { addBookmark, bookmarkIds, favoriteGames, recentGames, removeBookmark } from './library.service';

/** Mounted at /me — everything here belongs to the signed-in player. */
export const libraryRouter = Router();
libraryRouter.use(requireAuth);

libraryRouter.get(
  '/bookmarks/ids',
  handle({ query: bookmarkListQuerySchema }, ({ query, user }) => bookmarkIds(user().userId, query.targetType)),
);

libraryRouter.get(
  '/favorites/games',
  handle({}, ({ user }) => favoriteGames(user().userId)),
);

libraryRouter.get(
  '/recent/games',
  handle({}, ({ user }) => recentGames(user().userId)),
);

libraryRouter.post(
  '/bookmarks',
  handle({ body: bookmarkInputSchema }, async ({ body, user }) => {
    await addBookmark(user().userId, body.targetType, body.targetId);
  }),
);

libraryRouter.delete(
  '/bookmarks/:targetType/:targetId',
  handle({ params: bookmarkParamsSchema }, async ({ params, user }) => {
    await removeBookmark(user().userId, params.targetType, params.targetId);
  }),
);
