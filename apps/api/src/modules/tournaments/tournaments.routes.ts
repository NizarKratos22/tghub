import { Router } from 'express';
import {
  adminTournamentQuerySchema,
  adminTournamentUpdateSchema,
  idParamsSchema,
  slugParamsSchema,
  startggGameLookupSchema,
  tournamentImportSchema,
  tournamentListQuerySchema,
  tournamentSourceInputSchema,
  tournamentSourceUpdateSchema,
} from '@tgh/shared';
import { requireAuth, requireRole } from '../../core/auth/middleware';
import { AppError } from '../../core/http/errors';
import { handle } from '../../core/http/handler';
import { UpstreamError } from '../../core/http/upstream';
import { ProviderNotConfiguredError } from './providers/provider';
import { startggProvider } from './providers/startgg.provider';
import {
  adminListTournaments,
  adminUpdateTournament,
  followedIds,
  followedTournaments,
  followTournament,
  getTournament,
  listTournaments,
  unfollowTournament,
} from './tournaments.service';
import { toTournamentSummaries } from './tournaments.mapper';
import {
  createSource,
  deleteSource,
  importFromUrl,
  listSources,
  providerInfo,
  runSource,
  syncTournamentNow,
  updateSource,
} from './tournaments.sync';

/** Public + player routes. TG Hub never creates tournaments — it mirrors them. */
export const tournamentsRouter = Router();

tournamentsRouter.get('/', handle({ query: tournamentListQuerySchema }, ({ query }) => listTournaments(query)));

// Declared before "/:slug" so they aren't read as slugs.
tournamentsRouter.get('/following', requireAuth, handle({}, ({ user }) => followedTournaments(user().userId)));
tournamentsRouter.get('/following/ids', requireAuth, handle({}, ({ user }) => followedIds(user().userId)));

tournamentsRouter.get('/:slug', handle({ params: slugParamsSchema }, ({ params }) => getTournament(params.slug)));

tournamentsRouter.post(
  '/:slug/follow',
  requireAuth,
  handle({ params: slugParamsSchema }, async ({ params, user }) => {
    await followTournament(user().userId, params.slug);
  }),
);

tournamentsRouter.delete(
  '/:slug/follow',
  requireAuth,
  handle({ params: slugParamsSchema }, async ({ params, user }) => {
    await unfollowTournament(user().userId, params.slug);
  }),
);

/** Mounted at /admin/tournaments. */
export const adminTournamentsRouter = Router();
adminTournamentsRouter.use(requireRole('admin'));

adminTournamentsRouter.get('/providers', handle({}, () => providerInfo()));

adminTournamentsRouter.get(
  '/startgg/videogames',
  handle({ query: startggGameLookupSchema }, async ({ query }) => {
    try {
      return await startggProvider.lookupVideogames(query.q);
    } catch (error) {
      if (error instanceof UpstreamError || error instanceof ProviderNotConfiguredError) throw AppError.unprocessable(error.message);
      throw error;
    }
  }),
);

adminTournamentsRouter.get('/sources', handle({}, () => listSources()));
adminTournamentsRouter.post('/sources', handle({ body: tournamentSourceInputSchema, status: 201 }, ({ body }) => createSource(body)));
adminTournamentsRouter.patch(
  '/sources/:id',
  handle({ params: idParamsSchema, body: tournamentSourceUpdateSchema }, ({ params, body }) => updateSource(params.id, body)),
);
adminTournamentsRouter.delete(
  '/sources/:id',
  handle({ params: idParamsSchema }, async ({ params }) => {
    await deleteSource(params.id);
  }),
);
adminTournamentsRouter.post('/sources/:id/run', handle({ params: idParamsSchema }, ({ params }) => runSource(params.id)));

adminTournamentsRouter.post('/import', handle({ body: tournamentImportSchema }, ({ body }) => importFromUrl(body.url)));

adminTournamentsRouter.get('/', handle({ query: adminTournamentQuerySchema }, ({ query }) => adminListTournaments(query)));
adminTournamentsRouter.patch(
  '/:id',
  handle({ params: idParamsSchema, body: adminTournamentUpdateSchema }, ({ params, body }) => adminUpdateTournament(params.id, body)),
);
adminTournamentsRouter.post(
  '/:id/sync',
  handle({ params: idParamsSchema }, async ({ params }) => {
    const [summary] = await toTournamentSummaries([await syncTournamentNow(params.id)]);
    return summary;
  }),
);
