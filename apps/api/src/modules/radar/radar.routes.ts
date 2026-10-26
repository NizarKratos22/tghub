import { Router } from 'express';
import { radarListQuerySchema, radarSearchQuerySchema } from '@tgh/shared';
import { handle } from '../../core/http/handler';
import { listResources, radarKindCounts, radarSearch } from './radar.service';

export const radarRouter = Router();

radarRouter.get(
  '/',
  handle({ query: radarListQuerySchema }, ({ query }) => listResources(query)),
);

radarRouter.get(
  '/kinds',
  handle({ query: radarListQuerySchema.pick({ q: true, game: true }) }, ({ query }) => radarKindCounts(query)),
);

radarRouter.get(
  '/search',
  handle({ query: radarSearchQuerySchema }, ({ query, auth }) => radarSearch(query.q, auth, query.track)),
);
