import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { CLIENT_TYPE_HEADER, CSRF_HEADER } from './core/auth/context';
import { authenticate, csrfGuard } from './core/auth/middleware';
import { errorHandler, notFoundHandler } from './core/http/middleware';
import { apiLimiter } from './core/http/rate-limit';
import { logger } from './core/logger';
import { serveMediaFile } from './modules/media/media.routes';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();

  // Proxy hops in front (Next.js rewrite; plus Caddy in production) — needed for real client IPs in rate limits.
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
      allowedHeaders: ['content-type', 'authorization', CSRF_HEADER, CLIENT_TYPE_HEADER],
    }),
  );
  app.use(
    express.json({
      limit: '100kb',
      // Discord and Flouci sign the exact bytes they sent; keep them where a signature covers the body.
      verify: (req, _res, buf) => {
        const url = (req as express.Request).originalUrl ?? '';
        if (url.startsWith('/api/v1/discord/') || url.startsWith('/api/v1/payments/webhook/')) (req as express.Request).rawBody = buf;
      },
    }),
  );
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/health' },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    }),
  );

  app.get('/health', (_req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'up' : 'down' });
  });

  // Images skip the API limiter and auth: public, immutable, and requested by the dozen.
  app.get('/api/v1/media/:file', serveMediaFile);
  app.use('/api/v1', apiLimiter, authenticate, csrfGuard, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
