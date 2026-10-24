import type { Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import type { AuthContext } from '../auth/context';
import { AppError } from './errors';

type Infer<S> = S extends z.ZodType ? z.output<S> : undefined;

export interface HandlerContext<B, Q, P> {
  body: B;
  query: Q;
  params: P;
  req: Request;
  res: Response;
  auth: AuthContext | null;
  /** The signed-in user — throws a 401 for guests. */
  user(): AuthContext;
}

interface RouteSchemas<BS, QS, PS> {
  body?: BS;
  query?: QS;
  params?: PS;
  /** Status for a successful response with a body (default 200). */
  status?: number;
}

/**
 * Wraps a route: validates input with the shared Zod schemas, hands the
 * handler typed values, and writes the `{ data }` envelope. Returning
 * `undefined` sends 204. Thrown errors reach the error middleware.
 */
export function handle<
  BS extends z.ZodType | undefined = undefined,
  QS extends z.ZodType | undefined = undefined,
  PS extends z.ZodType | undefined = undefined,
>(
  schemas: RouteSchemas<BS, QS, PS>,
  fn: (ctx: HandlerContext<Infer<BS>, Infer<QS>, Infer<PS>>) => unknown,
): RequestHandler {
  return async (req, res) => {
    const ctx: HandlerContext<Infer<BS>, Infer<QS>, Infer<PS>> = {
      body: (schemas.body ? schemas.body.parse(req.body ?? {}) : undefined) as Infer<BS>,
      query: (schemas.query ? schemas.query.parse(req.query) : undefined) as Infer<QS>,
      params: (schemas.params ? schemas.params.parse(req.params) : undefined) as Infer<PS>,
      req,
      res,
      auth: req.auth,
      user() {
        if (!req.auth) throw AppError.unauthorized();
        return req.auth;
      },
    };

    const result = await fn(ctx);
    if (res.headersSent) return;
    if (result === undefined) {
      res.status(204).end();
      return;
    }
    res.status(schemas.status ?? 200).json({ data: result });
  };
}
