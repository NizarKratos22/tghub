import { Router } from 'express';
import { guideInputSchema, idParamsSchema, slugParamsSchema } from '@tgh/shared';
import { requireRole } from '../../core/auth/middleware';
import { handle } from '../../core/http/handler';
import { adminDeleteGuide, adminListGuides, adminSaveGuide, getGuide, listGuides } from './guides.service';

export const guidesRouter = Router();

guidesRouter.get('/', handle({}, () => listGuides()));
guidesRouter.get('/:slug', handle({ params: slugParamsSchema }, ({ params }) => getGuide(params.slug)));

/** Admin → Guides. Keyed by game id: one guide per game. */
export const adminGuidesRouter = Router();
adminGuidesRouter.use(requireRole('admin'));

adminGuidesRouter.get('/', handle({}, () => adminListGuides()));
adminGuidesRouter.put(
  '/:id',
  handle({ params: idParamsSchema, body: guideInputSchema }, ({ params, body, user }) => adminSaveGuide(params.id, body, user().userId)),
);
adminGuidesRouter.delete('/:id', handle({ params: idParamsSchema }, ({ params }) => adminDeleteGuide(params.id)));
