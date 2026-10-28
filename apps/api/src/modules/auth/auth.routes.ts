import type { Request, Response } from 'express';
import { Router } from 'express';
import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  usernameAvailableQuerySchema,
  verifyEmailSchema,
  type AuthResult,
} from '@tgh/shared';
import { requireAuth } from '../../core/auth/middleware';
import { env } from '../../config/env';
import { ACCESS_COOKIE, CLIENT_TYPE_HEADER, REFRESH_COOKIE, SESSION_HINT_COOKIE } from '../../core/auth/context';
import { handle } from '../../core/http/handler';
import { authLimiter, mailLimiter, verificationLimiter } from '../../core/http/rate-limit';
import { getMe } from '../users/users.service';
import { forgotPassword, resetPassword } from './account.service';
import { login, logout, refresh, register, usernameAvailable, type ClientMeta, type IssuedSession } from './auth.service';
import { resendVerificationCode, verificationStatus, verifyEmailCode } from './verification.service';

const REFRESH_COOKIE_PATH = '/api/v1/auth';

const clientMeta = (req: Request): ClientMeta => ({ userAgent: req.get('user-agent') ?? '', ip: req.ip ?? '' });
const isNative = (req: Request) => req.get(CLIENT_TYPE_HEADER) === 'native';

export function setSessionCookies(res: Response, session: IssuedSession) {
  const base = { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'lax' as const };
  res.cookie(ACCESS_COOKIE, session.accessToken, { ...base, path: '/', maxAge: env.ACCESS_TOKEN_TTL_SECONDS * 1000 });
  if (session.refreshToken) {
    res.cookie(REFRESH_COOKIE, session.refreshToken, { ...base, path: REFRESH_COOKIE_PATH, expires: session.refreshExpiresAt });
    res.cookie(SESSION_HINT_COOKIE, '1', { ...base, httpOnly: false, path: '/', expires: session.refreshExpiresAt });
  }
}

function clearSessionCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  res.clearCookie(SESSION_HINT_COOKIE, { path: '/' });
}

async function respond(req: Request, res: Response, session: IssuedSession): Promise<AuthResult> {
  setSessionCookies(res, session);
  return {
    user: await getMe(session.userId),
    accessToken: session.accessToken,
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    ...(isNative(req) && session.refreshToken ? { refreshToken: session.refreshToken } : {}),
  };
}

export const authRouter = Router();

authRouter.get(
  '/username-available',
  handle({ query: usernameAvailableQuerySchema }, async ({ query }) => ({ available: await usernameAvailable(query.username) })),
);

authRouter.post(
  '/register',
  authLimiter,
  mailLimiter,
  handle({ body: registerSchema, status: 201 }, async ({ body, req, res }) => {
    const { verification, ...session } = await register(body, clientMeta(req));
    return { ...(await respond(req, res, session)), ...(verification ? { verification } : {}) };
  }),
);

/* Email verification — the signed-in player confirms the code sent at sign-up. */
authRouter.get('/verify-email', requireAuth, handle({}, async ({ user }) => (await verificationStatus(user().userId)) ?? { verified: true }));

authRouter.post(
  '/verify-email',
  requireAuth,
  verificationLimiter,
  handle({ body: verifyEmailSchema }, async ({ body, user }) => {
    await verifyEmailCode(user().userId, body.code);
    return getMe(user().userId);
  }),
);

authRouter.post(
  '/verify-email/resend',
  requireAuth,
  verificationLimiter,
  handle({}, async ({ user }) => (await resendVerificationCode(user().userId)) ?? { verified: true }),
);

/* Forgot password: a code by email, then a new password. The first step never reveals whether the email has an account. */
authRouter.post(
  '/password/forgot',
  authLimiter,
  mailLimiter,
  handle({ body: forgotPasswordSchema }, async ({ body }) => ({ sent: true, ...(await forgotPassword(body.email)) })),
);

authRouter.post(
  '/password/reset',
  authLimiter,
  handle({ body: resetPasswordSchema }, async ({ body, req, res }) => respond(req, res, await resetPassword(body, clientMeta(req)))),
);

authRouter.post(
  '/login',
  authLimiter,
  handle({ body: loginSchema }, async ({ body, req, res }) => respond(req, res, await login(body, clientMeta(req)))),
);

authRouter.post(
  '/refresh',
  handle({ body: refreshSchema }, async ({ body, req, res }) => {
    try {
      const session = await refresh(body.refreshToken ?? (req.cookies?.[REFRESH_COOKIE] as string | undefined));
      return await respond(req, res, session);
    } catch (error) {
      clearSessionCookies(res);
      throw error;
    }
  }),
);

authRouter.post(
  '/logout',
  handle({ body: refreshSchema }, async ({ body, req, res }) => {
    await logout(body.refreshToken ?? (req.cookies?.[REFRESH_COOKIE] as string | undefined));
    clearSessionCookies(res);
  }),
);
