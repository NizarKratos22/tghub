import { AVATAR_COLORS, type EmailVerificationStatus, type LoginInput, type RegisterInput, type Role } from '@tgh/shared';
import { env } from '../../config/env';
import { hashPassword, verifyPassword } from '../../core/auth/password';
import { createRefreshToken, hashToken, signAccessToken } from '../../core/auth/tokens';
import { bus } from '../../core/events/bus';
import { AppError, isDuplicateKeyError } from '../../core/http/errors';
import { logger } from '../../core/logger';
import { dayKey } from '../../core/time/periods';
import { User, type UserDoc } from '../users/user.model';
import { Session, type SessionDoc } from './session.model';
import { sendVerificationCode } from './verification.service';

/** A concurrent refresh (two tabs) presenting the just-rotated token inside this window is benign. */
const ROTATION_GRACE_MS = 60_000;

export interface ClientMeta {
  userAgent: string;
  ip: string;
}

export interface IssuedSession {
  userId: string;
  accessToken: string;
  /** Null when only the access token was renewed (rotation grace window). */
  refreshToken: string | null;
  refreshExpiresAt: Date;
}

type SessionUser = Pick<UserDoc, '_id' | 'role' | 'status' | 'lastActiveDay'>;

let dummyHash: Promise<string> | null = null;

/** Runs a real hash comparison for unknown accounts so timing doesn't reveal which emails exist. */
async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword('timing-equaliser');
  await verifyPassword(password, await dummyHash);
}

async function markDailyLogin(user: SessionUser): Promise<void> {
  const today = dayKey();
  if (user.lastActiveDay === today) return;
  const result = await User.updateOne({ _id: user._id, lastActiveDay: { $ne: today } }, { $set: { lastActiveDay: today } });
  if (result.modifiedCount === 1) bus.emit('user.daily_login', { userId: String(user._id), day: today });
}

async function accessTokenFor(user: SessionUser, session: Pick<SessionDoc, '_id'>): Promise<string> {
  return signAccessToken({ userId: String(user._id), role: user.role as Role, sessionId: String(session._id) });
}

export async function startSession(user: SessionUser, meta: ClientMeta): Promise<IssuedSession> {
  const { token, hash } = createRefreshToken();
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const session = await Session.create({
    userId: user._id,
    tokenHash: hash,
    expiresAt,
    userAgent: meta.userAgent.slice(0, 200),
    ip: meta.ip,
  });
  await markDailyLogin(user);
  return {
    userId: String(user._id),
    accessToken: await accessTokenFor(user, session),
    refreshToken: token,
    refreshExpiresAt: expiresAt,
  };
}

export async function usernameAvailable(username: string): Promise<boolean> {
  return !(await User.exists({ usernameLower: username.toLowerCase() }));
}

export async function register(input: RegisterInput, meta: ClientMeta): Promise<IssuedSession & { verification: EmailVerificationStatus | null }> {
  const usernameLower = input.username.toLowerCase();
  const clash = await User.findOne({ $or: [{ email: input.email }, { usernameLower }] }).select('email').lean();
  if (clash) {
    throw clash.email === input.email
      ? AppError.conflict('An account with this email already exists', { fields: { email: 'Already registered — sign in instead' } })
      : AppError.conflict('That username is taken', { fields: { username: 'That username is taken' } });
  }

  let user;
  try {
    user = await User.create({
      email: input.email,
      username: input.username,
      usernameLower,
      displayName: input.username,
      passwordHash: await hashPassword(input.password),
      emailVerifiedAt: null,
      // Picking a governorate implies Tunisia; another country clears it.
      country: input.country ?? (input.region ? 'TN' : null),
      region: (input.country ?? 'TN') === 'TN' ? (input.region ?? null) : null,
      avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw AppError.conflict('That email or username was just taken');
    throw error;
  }

  bus.emit('user.registered', { userId: String(user._id) });
  const session = await startSession(user, meta);
  // The account exists either way; a mail hiccup just means the player taps "Resend".
  const verification = await sendVerificationCode(user).catch((error: unknown) => {
    logger.error({ err: error, userId: String(user._id) }, 'Verification email failed');
    return null;
  });
  return { ...session, verification };
}

export async function login(input: LoginInput, meta: ClientMeta): Promise<IssuedSession> {
  const identifier = input.identifier.toLowerCase();
  const user = await User.findOne(identifier.includes('@') ? { email: identifier } : { usernameLower: identifier })
    .select('+passwordHash')
    .lean<UserDoc>();

  if (!user) {
    await burnPasswordCheck(input.password);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email/username or password is incorrect');
  }
  if (!(await verifyPassword(input.password, user.passwordHash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email/username or password is incorrect');
  }
  if (user.status !== 'active') throw new AppError(403, 'ACCOUNT_SUSPENDED', 'This account is suspended');

  return startSession(user, meta);
}

async function activeUser(userId: unknown): Promise<SessionUser> {
  const user = await User.findById(userId).select('role status lastActiveDay').lean<SessionUser>();
  if (!user || user.status !== 'active') throw AppError.unauthorized('Session expired');
  return user;
}

/**
 * Rotates the refresh token. Presenting a token that was already rotated out
 * (outside the short grace window) is treated as theft and kills the session.
 */
export async function refresh(token: string | undefined): Promise<IssuedSession> {
  if (!token) throw AppError.unauthorized('Session expired');
  const hash = hashToken(token);
  const now = new Date();

  const next = createRefreshToken();
  const rotated = await Session.findOneAndUpdate(
    { tokenHash: hash, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { tokenHash: next.hash, previousTokenHash: hash, rotatedAt: now, lastUsedAt: now } },
    { returnDocument: 'after' },
  ).lean<SessionDoc>();

  if (rotated) {
    const user = await activeUser(rotated.userId).catch(async (error: unknown) => {
      await Session.updateOne({ _id: rotated._id }, { $set: { revokedAt: now } });
      throw error;
    });
    await markDailyLogin(user);
    return {
      userId: String(user._id),
      accessToken: await accessTokenFor(user, rotated),
      refreshToken: next.token,
      refreshExpiresAt: rotated.expiresAt,
    };
  }

  const previous = await Session.findOne({ previousTokenHash: hash, revokedAt: null }).lean<SessionDoc>();
  if (previous) {
    if (previous.rotatedAt && now.getTime() - previous.rotatedAt.getTime() < ROTATION_GRACE_MS) {
      const user = await activeUser(previous.userId);
      return {
        userId: String(user._id),
        accessToken: await accessTokenFor(user, previous),
        refreshToken: null,
        refreshExpiresAt: previous.expiresAt,
      };
    }
    await Session.updateOne({ _id: previous._id }, { $set: { revokedAt: now } });
    logger.warn({ sessionId: String(previous._id), userId: String(previous.userId) }, 'Refresh token reuse detected — session revoked');
  }

  throw AppError.unauthorized('Session expired');
}

export async function logout(token: string | undefined): Promise<void> {
  if (!token) return;
  await Session.updateOne({ tokenHash: hashToken(token), revokedAt: null }, { $set: { revokedAt: new Date() } });
}
