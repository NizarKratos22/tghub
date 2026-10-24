import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { logger } from '../logger';
import { recordError } from '../monitoring/error-log';
import { AppError, isDuplicateKeyError } from './errors';

function sendError(res: Response, status: number, code: string, message: string, details?: unknown) {
  res.status(status).json({ error: { code, message, ...(details === undefined ? {} : { details }) } });
}

export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(res, 404, 'ROUTE_NOT_FOUND', `No route for ${req.method} ${req.path}`);
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    return sendError(res, err.status, err.code, err.message, err.details);
  }

  if (err instanceof ZodError) {
    // Dotted paths ("deal.price") map straight onto form fields.
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || '_root';
      fields[key] ??= issue.message;
    }
    return sendError(res, 422, 'VALIDATION_FAILED', 'Some fields need attention', { fields });
  }

  if (err instanceof mongoose.Error.CastError) {
    return sendError(res, 400, 'INVALID_ID', `Invalid value for ${err.path}`);
  }

  if (isDuplicateKeyError(err)) {
    return sendError(res, 409, 'DUPLICATE', 'That already exists');
  }

  const type = (err as { type?: string }).type;
  if (type === 'entity.parse.failed') return sendError(res, 400, 'INVALID_JSON', 'Request body is not valid JSON');
  if (type === 'entity.too.large') return sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');

  logger.error({ err, method: req.method, path: req.path }, 'Unhandled error');
  const error = err instanceof Error ? err : new Error(String(err));
  void recordError({ source: 'api', name: error.name, message: error.message, stack: error.stack, where: `${req.method} ${req.route?.path ?? req.path}`, userId: req.auth?.userId });
  return sendError(res, 500, 'INTERNAL', 'Something went wrong on our side');
};
