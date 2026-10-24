import { Router } from 'express';
import {
  clanApplySchema,
  clanDecisionSchema,
  clanInputSchema,
  clanListQuerySchema,
  clanMemberParamsSchema,
  clanRequestParamsSchema,
  clanRoleUpdateSchema,
  clanTagParamsSchema,
  clanUpdateSchema,
  idParamsSchema,
  lfgDecisionSchema,
  lfgJoinSchema,
  lfgListQuerySchema,
  lfgPostInputSchema,
  lfgRequestParamsSchema,
} from '@tgh/shared';
import { requireAuth, requireVerifiedEmail } from '../../core/auth/middleware';
import { handle } from '../../core/http/handler';
import { squadWriteLimiter } from '../../core/http/rate-limit';
import {
  applyToClan,
  clanBadgeFor,
  createClan,
  decideApplication,
  disbandClan,
  getClan,
  leaveClan,
  listClans,
  removeMember,
  setMemberRole,
  transferLeadership,
  updateClan,
  withdrawApplication,
} from './clans.service';
import { applyToLfg, closeLfg, createLfg, decideLfg, getLfg, listLfg, listLfgRequests, withdrawFromLfg } from './lfg.service';

/** Mounted at /api/v1/clans. Reading is public; anything that changes a clan needs a verified account. */
export const clansRouter = Router();

clansRouter.get('/', handle({ query: clanListQuerySchema }, ({ query }) => listClans(query)));
clansRouter.get('/mine', requireAuth, handle({}, async ({ user }) => ({ clan: await clanBadgeFor(user().userId) })));
clansRouter.post('/', requireAuth, requireVerifiedEmail, squadWriteLimiter, handle({ body: clanInputSchema, status: 201 }, ({ body, user }) => createClan(user().userId, body)));

clansRouter.get('/:tag', handle({ params: clanTagParamsSchema }, ({ params, auth }) => getClan(params.tag, auth?.userId ?? null)));
clansRouter.patch('/:tag', requireAuth, handle({ params: clanTagParamsSchema, body: clanUpdateSchema }, ({ params, body, user }) => updateClan(user().userId, params.tag, body)));
clansRouter.delete(
  '/:tag',
  requireAuth,
  handle({ params: clanTagParamsSchema }, async ({ params, user }) => {
    await disbandClan(user().userId, params.tag);
  }),
);

clansRouter.post(
  '/:tag/join',
  requireAuth,
  requireVerifiedEmail,
  squadWriteLimiter,
  handle({ params: clanTagParamsSchema, body: clanApplySchema }, ({ params, body, user }) => applyToClan(user().userId, params.tag, body.message)),
);
clansRouter.delete('/:tag/application', requireAuth, handle({ params: clanTagParamsSchema }, ({ params, user }) => withdrawApplication(user().userId, params.tag)));
clansRouter.post(
  '/:tag/leave',
  requireAuth,
  handle({ params: clanTagParamsSchema }, async ({ params, user }) => {
    await leaveClan(user().userId, params.tag);
  }),
);

clansRouter.post(
  '/:tag/requests/:requestId',
  requireAuth,
  handle({ params: clanRequestParamsSchema, body: clanDecisionSchema }, ({ params, body, user }) =>
    decideApplication(user().userId, params.tag, params.requestId, body.accept),
  ),
);
clansRouter.patch(
  '/:tag/members/:userId',
  requireAuth,
  handle({ params: clanMemberParamsSchema, body: clanRoleUpdateSchema }, ({ params, body, user }) => setMemberRole(user().userId, params.tag, params.userId, body.role)),
);
clansRouter.post(
  '/:tag/members/:userId/leader',
  requireAuth,
  handle({ params: clanMemberParamsSchema }, ({ params, user }) => transferLeadership(user().userId, params.tag, params.userId)),
);
clansRouter.delete('/:tag/members/:userId', requireAuth, handle({ params: clanMemberParamsSchema }, ({ params, user }) => removeMember(user().userId, params.tag, params.userId)));

/** Mounted at /api/v1/lfg — the teammate finder. */
export const lfgRouter = Router();

lfgRouter.get('/', handle({ query: lfgListQuerySchema }, ({ query, auth }) => listLfg(query, auth?.userId ?? null)));
lfgRouter.post('/', requireAuth, requireVerifiedEmail, squadWriteLimiter, handle({ body: lfgPostInputSchema, status: 201 }, ({ body, user }) => createLfg(user().userId, body)));
lfgRouter.get('/:id', handle({ params: idParamsSchema }, ({ params, auth }) => getLfg(params.id, auth?.userId ?? null)));
lfgRouter.post('/:id/close', requireAuth, handle({ params: idParamsSchema }, ({ params, user }) => closeLfg(user().userId, params.id)));

lfgRouter.post(
  '/:id/requests',
  requireAuth,
  requireVerifiedEmail,
  squadWriteLimiter,
  handle({ params: idParamsSchema, body: lfgJoinSchema }, ({ params, body, user }) => applyToLfg(user().userId, params.id, body)),
);
lfgRouter.delete('/:id/requests/mine', requireAuth, handle({ params: idParamsSchema }, ({ params, user }) => withdrawFromLfg(user().userId, params.id)));
lfgRouter.get('/:id/requests', requireAuth, handle({ params: idParamsSchema }, ({ params, user }) => listLfgRequests(user().userId, params.id)));
lfgRouter.post(
  '/:id/requests/:requestId',
  requireAuth,
  handle({ params: lfgRequestParamsSchema, body: lfgDecisionSchema }, ({ params, body, user }) => decideLfg(user().userId, params.id, params.requestId, body.accept)),
);
