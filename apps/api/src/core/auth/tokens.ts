import { createHash, randomBytes } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';
import { ROLES, type Role } from '@tgh/shared';
import { env } from '../../config/env';
import type { AuthContext } from './context';

const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const ISSUER = 'tghub-api';
const AUDIENCE = 'tghub';

export async function signAccessToken(auth: AuthContext): Promise<string> {
  return new SignJWT({ role: auth.role, sid: auth.sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(auth.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<AuthContext | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: ISSUER, audience: AUDIENCE, algorithms: ['HS256'] });
    const role = payload.role as Role;
    if (!payload.sub || typeof payload.sid !== 'string' || !ROLES.includes(role)) return null;
    return { userId: payload.sub, role, sessionId: payload.sid, expiresAt: (payload.exp ?? 0) * 1000 };
  } catch {
    return null;
  }
}

/** Opaque refresh token; only its SHA-256 is stored. */
export function createRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}
