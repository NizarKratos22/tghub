import { Router } from 'express';
import {
  compatCheckSchema,
  compatibleGamesQuerySchema,
  componentMatchQuerySchema,
  componentQuerySchema,
  idParamsSchema,
  pcSpecInputSchema,
  pcSpecUpdateSchema,
} from '@tgh/shared';
import { requireAuth } from '../../core/auth/middleware';
import { handle } from '../../core/http/handler';
import { listPresets } from './hardware.presets';
import {
  checkCompatibility,
  compatibleGames,
  createSpec,
  deleteSpec,
  listSpecs,
  matchComponent,
  searchComponents,
  updateSpec,
} from './hardware.service';

export const pcRouter = Router();

pcRouter.get('/components', handle({ query: componentQuerySchema }, ({ query }) => searchComponents(query)));

/** PC Lab's "Detect my PC": a reported part name → our index entry, or null. */
pcRouter.get('/components/match', handle({ query: componentMatchQuerySchema }, ({ query }) => matchComponent(query)));

pcRouter.get('/presets', handle({}, () => listPresets()));

/** Works for guests with inline hardware, or with a saved rig when signed in. */
pcRouter.post(
  '/check',
  handle({ body: compatCheckSchema }, ({ body, auth }) => checkCompatibility(body, auth)),
);

pcRouter.get(
  '/compatible-games',
  handle({ query: compatibleGamesQuerySchema }, ({ query, auth }) => compatibleGames(auth, query)),
);

pcRouter.get('/specs', requireAuth, handle({}, ({ user }) => listSpecs(user().userId)));

pcRouter.post(
  '/specs',
  requireAuth,
  handle({ body: pcSpecInputSchema, status: 201 }, ({ body, user }) => createSpec(user().userId, body)),
);

pcRouter.patch(
  '/specs/:id',
  requireAuth,
  handle({ params: idParamsSchema, body: pcSpecUpdateSchema }, ({ params, body, user }) =>
    updateSpec(user().userId, params.id, body),
  ),
);

pcRouter.delete(
  '/specs/:id',
  requireAuth,
  handle({ params: idParamsSchema }, async ({ params, user }) => {
    await deleteSpec(user().userId, params.id);
  }),
);
