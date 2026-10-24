import type { Request } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

const rateLimitBody = { error: { code: 'RATE_LIMITED', message: 'Too many requests — slow down and try again shortly' } };

/** Broad per-IP ceiling for the whole API. */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: rateLimitBody,
});

/** Login / register: slows down credential stuffing. */
export const authLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: rateLimitBody,
});

/** Per-player budgets for writes that cost storage or someone else's attention. */
const byUser = (req: Request) => req.auth?.userId ?? ipKeyGenerator(req.ip ?? '');

/** Email codes: guesses and resends, per player. The code itself also locks after 5 misses. */
export const verificationLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: byUser,
  message: rateLimitBody,
});

/** Photo uploads: each one is decoded and re-encoded. */
export const uploadLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: byUser,
  message: rateLimitBody,
});

/** Creating and editing listings. */
export const listingWriteLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 40,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: byUser,
  message: rateLimitBody,
});

/** Creating clans, applying, posting in the teammate finder. */
export const squadWriteLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: byUser,
  message: rateLimitBody,
});

/** Browser crash reports: a buggy page can loop, so a client gets a small budget. */
export const errorReportLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: rateLimitBody,
});

/** Follows and GGs: a real player taps these a lot, a bot taps them more. */
export const followLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: byUser,
  message: rateLimitBody,
});

/** "Typing…" pings: the client sends at most one every few seconds while typing. */
export const typingLimiter = rateLimit({
  windowMs: 60_000,
  limit: 40,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: byUser,
  message: rateLimitBody,
});

/** Marketplace messages — plenty for a real chat, too few for spam runs. */
export const messageLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: byUser,
  message: rateLimitBody,
});
