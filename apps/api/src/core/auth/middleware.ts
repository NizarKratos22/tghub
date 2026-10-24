import type { RequestHandler } from 'express';
import type { Role } from '@tgh/shared';
import { AppError } from '../http/errors';
import { ACCESS_COOKIE, CSRF_HEADER, REFRESH_COOKIE } from './context';
import { verifyAccessToken } from './tokens';

/** Attaches `req.auth` when a valid access token is present. Never rejects — guards do that. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  req.auth = null;
  req.authVia = null;

  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    req.auth = await verifyAccessToken(header.slice('Bearer '.length).trim());
    if (req.auth) req.authVia = 'bearer';
  } else {
    const cookie = req.cookies?.[ACCESS_COOKIE] as string | undefined;
    if (cookie) {
      req.auth = await verifyAccessToken(cookie);
      if (req.auth) req.authVia = 'cookie';
    }
  }
  next();
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Cookie-authenticated writes must carry X-TGH-CSRF. Browsers can't add custom
 * headers cross-site without a CORS preflight, which our CORS policy rejects.
 */
export const csrfGuard: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const carriesCookies = Boolean(req.cookies?.[ACCESS_COOKIE] || req.cookies?.[REFRESH_COOKIE]);
  const usesBearer = req.headers.authorization?.startsWith('Bearer ');
  if (carriesCookies && !usesBearer && req.get(CSRF_HEADER) !== '1') {
    throw new AppError(403, 'CSRF_REJECTED', 'Missing request verification header');
  }
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth) throw AppError.unauthorized();
  next();
};

/**
 * For actions that reach other players (listing, messaging, reporting, uploads).
 * Looks the flag up per request so it applies the moment the code is confirmed.
 */
export const requireVerifiedEmail: RequestHandler = async (req, _res, next) => {
  if (!req.auth) throw AppError.unauthorized();
  const { isEmailVerified } = await import('../../modules/auth/verification.service');
  if (!(await isEmailVerified(req.auth.userId))) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Confirm your email address first — we sent you a 6-digit code');
  }
  next();
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) throw AppError.unauthorized();
    if (!roles.includes(req.auth.role)) throw AppError.forbidden();
    next();
  };
}
