import { Router } from 'express';
import { idParamsSchema, objectIdSchema, usernameSchema } from '@tgh/shared';
import { z } from 'zod';
import { requireAuth } from '../../core/auth/middleware';
import { handle } from '../../core/http/handler';
import { followLimiter } from '../../core/http/rate-limit';
import { feed, follow, followList, followStatus, playerActivity, suggestions, toggleGg, unfollow } from './social.service';

const cursorQuery = z.object({ before: objectIdSchema.optional() });
const usernameParams = z.object({ username: usernameSchema });

/** Mounted at /api/v1/feed. */
export const feedRouter = Router();
feedRouter.use(requireAuth);

feedRouter.get('/', handle({ query: cursorQuery }, ({ query, user }) => feed(user().userId, query.before)));
feedRouter.get('/suggestions', handle({}, ({ user }) => suggestions(user().userId)));
feedRouter.post('/:id/gg', followLimiter, handle({ params: idParamsSchema }, ({ params, user }) => toggleGg(user().userId, params.id)));

/** Mounted at /api/v1/users, next to the profile routes. */
export const followRouter = Router();

followRouter.get('/:username/follow', handle({ params: usernameParams }, ({ params, auth }) => followStatus(auth?.userId ?? null, params.username)));
followRouter.post('/:username/follow', requireAuth, followLimiter, handle({ params: usernameParams }, ({ params, user }) => follow(user().userId, params.username)));
followRouter.delete('/:username/follow', requireAuth, followLimiter, handle({ params: usernameParams }, ({ params, user }) => unfollow(user().userId, params.username)));
followRouter.get(
  '/:username/followers',
  handle({ params: usernameParams, query: cursorQuery }, ({ params, query }) => followList(params.username, 'followers', query.before)),
);
followRouter.get(
  '/:username/following',
  handle({ params: usernameParams, query: cursorQuery }, ({ params, query }) => followList(params.username, 'following', query.before)),
);
followRouter.get(
  '/:username/activity',
  handle({ params: usernameParams, query: cursorQuery }, ({ params, query, auth }) => playerActivity(params.username, auth?.userId ?? null, query.before)),
);
