import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { env } from '../../config/env';
import { AppError } from '../../core/http/errors';

const COOKIE = 'tgh_oauth';
const COOKIE_PATH = '/api/v1/auth';
const TTL_MS = 10 * 60 * 1000;

export type OAuthProvider = 'discord' | 'steam';

export interface OAuthState {
  provider: OAuthProvider;
  mode: 'login' | 'link';
  /** Random value echoed by the provider; ties the callback to this browser. */
  state: string;
  /** Path to return to on our site. */
  next: string;
  /** For linking: the account that started the flow. */
  userId: string | null;
  exp: number;
}

function mac(payload: string): string {
  return createHmac('sha256', env.JWT_ACCESS_SECRET).update(`oauth:${payload}`).digest('base64url');
}

/** Only same-site paths: an attacker-supplied "next" must never become an open redirect. */
export function safeNext(next: unknown, fallback = '/'): string {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next.slice(0, 300) : fallback;
}

/** Stores the flow in a short-lived signed cookie and returns the `state` to send to the provider. */
export function issueOAuthState(res: Response, input: Omit<OAuthState, 'state' | 'exp'>): string {
  const state = randomBytes(24).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ ...input, state, exp: Date.now() + TTL_MS } satisfies OAuthState)).toString('base64url');
  res.cookie(COOKIE, `${payload}.${mac(payload)}`, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    // Lax still travels on the provider's top-level redirect back to us.
    sameSite: 'lax',
    path: COOKIE_PATH,
    maxAge: TTL_MS,
  });
  return state;
}

/** Validates and consumes the cookie; any mismatch means the callback didn't come from our own flow. */
export function consumeOAuthState(req: Request, res: Response, provider: OAuthProvider, state: unknown): OAuthState {
  const raw = req.cookies?.[COOKIE] as string | undefined;
  res.clearCookie(COOKIE, { path: COOKIE_PATH });
  const fail = () => new AppError(400, 'OAUTH_STATE', 'That sign-in link expired — try again');
  if (!raw || typeof state !== 'string') throw fail();
  const [payload, signature] = raw.split('.');
  if (!payload || !signature) throw fail();
  const expected = Buffer.from(mac(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw fail();
  let parsed: OAuthState;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as OAuthState;
  } catch {
    throw fail();
  }
  const stateMatches = parsed.state.length === state.length && timingSafeEqual(Buffer.from(parsed.state), Buffer.from(state));
  if (parsed.provider !== provider || parsed.exp < Date.now() || !stateMatches) throw fail();
  return parsed;
}
