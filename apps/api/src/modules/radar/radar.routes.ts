import { Router } from 'express';
import { radarListQuerySchema, radarSearchQuerySchema } from '@tgh/shared';
import { handle } from '../../core/http/handler';
import { listResources, radarSearch } from './radar.service';

export const radarRouter = Router();

radarRouter.get(
  '/',
  handle({ query: radarListQuerySchema }, ({ query }) => listResources(query)),
);

radarRouter.get(
  '/search',
  handle({ query: radarSearchQuerySchema }, ({ query, auth }) => radarSearch(query.q, auth)),
);
