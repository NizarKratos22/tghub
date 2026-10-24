import type { Role } from '@tgh/shared';

export interface AuthContext {
  userId: string;
  role: Role;
  sessionId: string;
  /** Epoch ms when the access token stops being valid (set on verified requests). */
  expiresAt?: number;
}

export const ACCESS_COOKIE = 'tgh_at';
export const REFRESH_COOKIE = 'tgh_rt';
/** Readable by scripts and carries no secret: it only tells the web app a session exists, so guests skip the /me probe. */
export const SESSION_HINT_COOKIE = 'tgh_session';
/** Header the web client sends on writes; a custom header forces a CORS preflight. */
export const CSRF_HEADER = 'x-tgh-csrf';
/** Native apps opt into receiving the refresh token in the response body. */
export const CLIENT_TYPE_HEADER = 'x-client-type';
