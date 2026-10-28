import type { Types } from 'mongoose';
import type { EmailVerificationStatus } from '@tgh/shared';
import { env } from '../../config/env';
import { AppError } from '../../core/http/errors';
import { currentLocale } from '../../core/http/request-context';
import { logger } from '../../core/logger';
import { mailer } from '../../core/mail/mailer';
import { codeEmail, welcomeEmail } from '../../core/mail/templates';
import { User, type UserDoc } from '../users/user.model';
import { checkCode, consumeCode, issueCode, maskEmail, pendingCode, resendAtFor } from './codes';
import type { CodePurpose } from './codes.model';

/** Status for the code-entry screens. The dev code only exists without SMTP, outside production. */
export function codeStatus(target: string, sentAt: Date, expiresAt: Date, code?: string): EmailVerificationStatus {
  return {
    email: maskEmail(target),
    expiresAt: expiresAt.toISOString(),
    resendAt: resendAtFor(sentAt),
    ...(code && !mailer.delivers && !env.isProduction ? { devCode: code } : {}),
  };
}

/**
 * The display name to greet with, or '' when the address isn't proven yet: a sign-up or a new
 * email can be anyone's, and a name is free text the account holder typed.
 */
export function greetingName(user: Pick<UserDoc, 'displayName'> & { emailVerifiedAt?: Date | null }, purpose: CodePurpose): string {
  // A missing field means the account predates verification — treat it as verified.
  return purpose === 'password_reset' && user.emailVerifiedAt !== null ? user.displayName : '';
}

/** Issues a code for `purpose`, emails it to `target` and returns what the UI shows. */
export async function sendCode(
  user: Pick<UserDoc, '_id' | 'displayName'> & { emailVerifiedAt?: Date | null },
  purpose: CodePurpose,
  target: string,
): Promise<EmailVerificationStatus> {
  const issued = await issueCode(user._id, purpose, target);
  await mailer.send({ to: target, ...codeEmail(purpose, greetingName(user, purpose), issued.code, currentLocale()) });
  return codeStatus(target, issued.sentAt, issued.expiresAt, issued.code);
}

type VerifiableUser = Pick<UserDoc, '_id' | 'email' | 'displayName'>;

export function sendVerificationCode(user: VerifiableUser): Promise<EmailVerificationStatus> {
  return sendCode(user, 'signup', user.email);
}

async function unverifiedUser(userId: string): Promise<(VerifiableUser & Pick<UserDoc, 'emailVerifiedAt'>) | null> {
  const user = await User.findById(userId).select('email displayName emailVerifiedAt').lean<VerifiableUser & Pick<UserDoc, 'emailVerifiedAt'>>();
  if (!user) throw AppError.unauthorized();
  // A missing field means the account predates verification — treat it as verified.
  return user.emailVerifiedAt === null ? user : null;
}

export async function resendVerificationCode(userId: string): Promise<EmailVerificationStatus | null> {
  const user = await unverifiedUser(userId);
  return user ? sendVerificationCode(user) : null;
}

/** What the verify page shows on load (no new code is sent). */
export async function verificationStatus(userId: string): Promise<EmailVerificationStatus | null> {
  const user = await unverifiedUser(userId);
  if (!user) return null;
  const record = await pendingCode(user._id, 'signup');
  if (!record) return { email: maskEmail(user.email), expiresAt: new Date(0).toISOString(), resendAt: new Date().toISOString() };
  return codeStatus(record.target, record.sentAt, record.expiresAt);
}

export async function verifyEmailCode(userId: string, code: string): Promise<void> {
  const user = await unverifiedUser(userId);
  if (!user) return; // already verified — idempotent
  // A code sent to an older address is void once the email changes.
  const record = await checkCode(user._id, 'signup', code, user.email);
  // Conditional, so two simultaneous submits of the same code verify (and welcome) only once.
  const { modifiedCount } = await User.updateOne({ _id: user._id, emailVerifiedAt: null }, { $set: { emailVerifiedAt: new Date() } });
  await consumeCode(record);
  if (modifiedCount !== 1) return;
  // A welcome, not a requirement: a mail outage must not fail the verification.
  mailer
    .send({ to: user.email, ...welcomeEmail(user.displayName, currentLocale()) })
    .catch((error: unknown) => logger.error({ err: error, userId: String(user._id) }, 'Welcome email failed'));
}

/** Lean check used by route guards. */
export async function isEmailVerified(userId: string | Types.ObjectId): Promise<boolean> {
  const user = await User.findById(userId).select('emailVerifiedAt').lean<Pick<UserDoc, 'emailVerifiedAt'>>();
  return Boolean(user) && user!.emailVerifiedAt !== null;
}
