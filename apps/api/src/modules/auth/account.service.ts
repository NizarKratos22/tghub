import type { EmailVerificationStatus, SessionInfo } from '@tgh/shared';
import { env } from '../../config/env';
import { hashPassword, verifyPassword } from '../../core/auth/password';
import { AppError } from '../../core/http/errors';
import { currentLocale } from '../../core/http/request-context';
import { logger } from '../../core/logger';
import type { NoticeKind } from '../../core/mail/copy';
import { mailer } from '../../core/mail/mailer';
import { codeEmail, noticeEmail } from '../../core/mail/templates';
import { User, type UserDoc } from '../users/user.model';
import { startSession, type ClientMeta, type IssuedSession } from './auth.service';
import { checkCode, consumeCode, issueCode, maskEmail } from './codes';
import { Session, type SessionDoc } from './session.model';
import { greetingName, sendCode } from './verification.service';

type AccountUser = Pick<UserDoc, '_id' | 'email' | 'displayName' | 'role' | 'status' | 'lastActiveDay' | 'emailVerifiedAt'>;
const ACCOUNT_FIELDS = 'email displayName role status lastActiveDay emailVerifiedAt';

/** Fire-and-forget security notice; a mail outage must not undo a password change. */
function notify(to: string, name: string, kind: NoticeKind, newEmail?: string) {
  const email = noticeEmail(kind, { name, at: new Date(), maskedNewEmail: newEmail ? maskEmail(newEmail) : undefined }, currentLocale());
  mailer.send({ to, ...email }).catch((error: unknown) => logger.error({ err: error, kind }, 'Security notice failed'));
}

/* ───────────── Forgot / reset password ───────────── */

/**
 * Always answers the same way, whether or not the address has an account, so
 * the endpoint can't be used to find out who plays here.
 */
export async function forgotPassword(email: string): Promise<{ devCode?: string }> {
  const user = await User.findOne({ email, status: 'active' }).select(ACCOUNT_FIELDS).lean<AccountUser>();
  if (!user) return {};
  try {
    const issued = await issueCode(user._id, 'password_reset', user.email);
    const message = codeEmail('password_reset', greetingName(user, 'password_reset'), issued.code, currentLocale());
    // Not awaited: neither the SMTP round trip's time nor its errors may reveal that the account exists.
    mailer.send({ to: user.email, ...message }).catch((error: unknown) => logger.error({ err: error, userId: String(user._id) }, 'Password reset email failed'));
    return !mailer.delivers && !env.isProduction ? { devCode: issued.code } : {};
  } catch (error) {
    // Cooldowns and caps stay silent here too — the response must not differ.
    if (error instanceof AppError && error.status === 429) return {};
    throw error;
  }
}

export async function resetPassword(input: { email: string; code: string; password: string }, meta: ClientMeta): Promise<IssuedSession> {
  const user = await User.findOne({ email: input.email, status: 'active' }).select(ACCOUNT_FIELDS).lean<AccountUser>();
  if (!user) throw AppError.unprocessable('This code has expired — send a new one', { fields: { code: 'This code has expired — send a new one' } });

  const record = await checkCode(user._id, 'password_reset', input.code, user.email);
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        passwordHash: await hashPassword(input.password),
        passwordSet: true,
        // Receiving the code proves they own the address.
        ...(user.emailVerifiedAt === null ? { emailVerifiedAt: new Date() } : {}),
      },
    },
  );
  await consumeCode(record);
  // Anyone holding an old session is signed out — the usual reason for a reset.
  await Session.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  notify(user.email, user.displayName, 'password_reset');
  return startSession(user, meta);
}

/* ───────────── Signed-in changes ───────────── */

async function confirmPassword(userId: string, password: string): Promise<AccountUser> {
  const user = await User.findById(userId).select(`${ACCOUNT_FIELDS} +passwordHash`).lean<AccountUser & Pick<UserDoc, 'passwordHash'>>();
  if (!user) throw AppError.unauthorized();
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw AppError.unprocessable('That password is not right', { fields: { currentPassword: 'That password is not right', password: 'That password is not right' } });
  }
  return user;
}

export async function changePassword(userId: string, sessionId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await confirmPassword(userId, currentPassword);
  await User.updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(newPassword) } });
  // Keep this device signed in, sign out the rest.
  await Session.updateMany({ userId: user._id, revokedAt: null, _id: { $ne: sessionId } }, { $set: { revokedAt: new Date() } });
  // An unproven address may belong to someone else: no notices (with the player's chosen name) go there.
  if (user.emailVerifiedAt !== null) notify(user.email, user.displayName, 'password_changed');
}

/** Step 1: the code goes to the new address; nothing changes until it is confirmed. */
export async function requestEmailChange(userId: string, newEmail: string, password: string): Promise<EmailVerificationStatus> {
  const user = await confirmPassword(userId, password);
  if (newEmail === user.email) throw AppError.unprocessable('That is already your email', { fields: { email: 'That is already your email' } });
  if (await User.exists({ email: newEmail })) {
    throw AppError.conflict('Another account uses this email', { fields: { email: 'Another account uses this email' } });
  }
  return sendCode(user, 'email_change', newEmail);
}

/** Step 2: confirm the code, swap the address, and tell the old one. */
export async function confirmEmailChange(userId: string, code: string): Promise<void> {
  const user = await User.findById(userId).select(ACCOUNT_FIELDS).lean<AccountUser>();
  if (!user) throw AppError.unauthorized();
  const record = await checkCode(user._id, 'email_change', code);
  if (await User.exists({ email: record.target, _id: { $ne: user._id } })) {
    throw AppError.conflict('Another account started using this email meanwhile', { fields: { code: 'Another account uses this email now' } });
  }
  await User.updateOne({ _id: user._id }, { $set: { email: record.target, emailVerifiedAt: new Date() } });
  await consumeCode(record);
  if (user.emailVerifiedAt !== null) notify(user.email, user.displayName, 'email_changed', record.target);
}

/* ───────────── Devices ───────────── */

/** "Chrome on Windows", "Safari on iPhone", "TG Hub Android app". Good enough to recognise a device. */
export function describeDevice(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (!ua) return 'Unknown device';
  if (ua.includes('tghub-android')) return 'TG Hub Android app';
  const browser = ua.includes('edg/')
    ? 'Edge'
    : ua.includes('opr/') || ua.includes('opera')
      ? 'Opera'
      : ua.includes('firefox/')
        ? 'Firefox'
        : ua.includes('chrome/')
          ? 'Chrome'
          : ua.includes('safari/')
            ? 'Safari'
            : ua.includes('curl')
              ? 'curl'
              : 'Browser';
  const os = ua.includes('iphone')
    ? 'iPhone'
    : ua.includes('ipad')
      ? 'iPad'
      : ua.includes('android')
        ? 'Android'
        : ua.includes('windows')
          ? 'Windows'
          : ua.includes('mac os')
            ? 'macOS'
            : ua.includes('linux')
              ? 'Linux'
              : null;
  return os ? `${browser} on ${os}` : browser;
}

export async function listSessions(userId: string, currentSessionId: string): Promise<SessionInfo[]> {
  const sessions = await Session.find({ userId, revokedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ lastUsedAt: -1 })
    .limit(20)
    .lean<SessionDoc[]>();
  return sessions.map((session) => ({
    id: String(session._id),
    device: describeDevice(session.userAgent),
    ip: session.ip,
    lastUsedAt: session.lastUsedAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
    current: String(session._id) === currentSessionId,
  }));
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  await Session.updateOne({ _id: sessionId, userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export async function revokeOtherSessions(userId: string, currentSessionId: string): Promise<{ revoked: number }> {
  const result = await Session.updateMany({ userId, revokedAt: null, _id: { $ne: currentSessionId } }, { $set: { revokedAt: new Date() } });
  return { revoked: result.modifiedCount };
}
