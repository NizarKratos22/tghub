import { Router } from 'express';
import { requireAuth } from '../../core/auth/middleware';
import { realtime } from '../../core/realtime/hub';

/** Clients reconnect this long after a drop (the browser's EventSource honours it). */
const RETRY_MS = 4_000;

/** Mounted at /api/v1/stream. */
export const streamRouter = Router();

/**
 * The signed-in player's live event stream (server-sent events).
 *
 * The stream ends when the access token that opened it expires, so a revoked
 * session stops receiving events within minutes; the web client refreshes
 * its token and reconnects. `no-transform` keeps the Next.js rewrite and any
 * proxy from compressing — and therefore buffering — the stream.
 */
streamRouter.get('/', requireAuth, (req, res) => {
  const { userId, expiresAt } = req.auth!;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`retry: ${RETRY_MS}\n: connected\n\n`);

  const disconnect = realtime.connect(userId, res);
  const lifetime = setTimeout(() => res.end(), Math.max(5_000, (expiresAt ?? 0) - Date.now()));
  req.on('close', () => {
    clearTimeout(lifetime);
    disconnect();
  });
});
