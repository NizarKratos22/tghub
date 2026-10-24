import { Router } from 'express';
import { idParamsSchema } from '@tgh/shared';
import { z } from 'zod';
import { requireRole } from '../auth/middleware';
import { AppError } from '../http/errors';
import { handle } from '../http/handler';
import { errorReportLimiter } from '../http/rate-limit';
import { ErrorEvent, recordError, type ErrorEventDoc } from './error-log';

const reportSchema = z.object({
  name: z.string().trim().max(80).optional(),
  message: z.string().trim().min(1).max(500),
  stack: z.string().max(4_000).nullish(),
  where: z.string().max(300).nullish(),
});

/** Mounted at /api/v1/errors — the web app reports its crashes here. */
export const errorReportRouter = Router();
errorReportRouter.post(
  '/',
  errorReportLimiter,
  handle({ body: reportSchema }, async ({ body, auth }) => {
    await recordError({ source: 'web', ...body, userId: auth?.userId ?? null });
  }),
);

/** Mounted at /api/v1/admin/errors. */
export const adminErrorsRouter = Router();
adminErrorsRouter.use(requireRole('admin'));

const toDto = (doc: ErrorEventDoc) => ({
  id: String(doc._id),
  source: doc.source,
  name: doc.name,
  message: doc.message,
  stack: doc.stack,
  where: doc.where,
  count: doc.count,
  players: doc.userIds.length,
  firstSeenAt: doc.firstSeenAt.toISOString(),
  lastSeenAt: doc.lastSeenAt.toISOString(),
  resolvedAt: doc.resolvedAt?.toISOString() ?? null,
});

adminErrorsRouter.get(
  '/',
  handle({ query: z.object({ status: z.enum(['open', 'resolved']).default('open') }) }, async ({ query }) => {
    const docs = await ErrorEvent.find({ resolvedAt: query.status === 'open' ? null : { $ne: null } })
      .sort({ lastSeenAt: -1 })
      .limit(100)
      .lean<ErrorEventDoc[]>();
    return docs.map(toDto);
  }),
);

adminErrorsRouter.post(
  '/:id/resolve',
  handle({ params: idParamsSchema, body: z.object({ resolved: z.boolean() }) }, async ({ params, body }) => {
    const doc = await ErrorEvent.findByIdAndUpdate(params.id, { $set: { resolvedAt: body.resolved ? new Date() : null } }, { returnDocument: 'after' }).lean<ErrorEventDoc>();
    if (!doc) throw AppError.notFound('Error');
    return toDto(doc);
  }),
);
