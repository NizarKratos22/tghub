import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { Types } from 'mongoose';
import { env } from '../../config/env';
import { AppError } from '../../core/http/errors';
import { OneTimeCode, type CodePurpose, type OneTimeCodeDoc } from './codes.model';

export const CODE_TTL_MS = 15 * 60_000;
export const RESEND_COOLDOWN_MS = 60_000;
export const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_DAY = 8;
const DAY_MS = 24 * 60 * 60_000;

export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Keyed hash bound to the account and purpose: a leaked row can't be replayed elsewhere or brute-forced offline. */
export function hashCode(purpose: CodePurpose, userId: string, code: string): string {
  return createHmac('sha256', env.JWT_ACCESS_SECRET).update(`${purpose}:${userId}:${code}`).digest('hex');
}

export function codeMatches(purpose: CodePurpose, userId: string, code: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashCode(purpose, userId, code), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

/** "kr•••••@gmail.com" — enough to recognise the address, not enough to harvest it. */
export function maskEmail(email: string): string {
  const [name = '', domain = ''] = email.split('@');
  const visible = name.length <= 2 ? name.slice(0, 1) : name.slice(0, 2);
  return `${visible}${'•'.repeat(Math.max(3, Math.min(8, name.length - visible.length)))}@${domain}`;
}

export interface IssuedCode {
  code: string;
  sentAt: Date;
  expiresAt: Date;
}

/** Creates (or replaces) the code for this purpose, enforcing the resend cooldown and daily cap. */
export async function issueCode(userId: Types.ObjectId | string, purpose: CodePurpose, target: string): Promise<IssuedCode> {
  const now = new Date();
  const existing = await OneTimeCode.findOne({ userId, purpose }).lean<OneTimeCodeDoc>();

  let sendsToday = 1;
  let windowStartedAt = now;
  if (existing) {
    const resendAt = existing.sentAt.getTime() + RESEND_COOLDOWN_MS;
    if (resendAt > now.getTime()) {
      throw new AppError(429, 'RESEND_TOO_SOON', 'Wait a moment before asking for another code', { resendAt: new Date(resendAt).toISOString() });
    }
    const sameWindow = now.getTime() - existing.windowStartedAt.getTime() < DAY_MS;
    if (sameWindow && existing.sendsToday >= MAX_SENDS_PER_DAY) {
      throw new AppError(429, 'TOO_MANY_CODES', 'Too many codes today — try again tomorrow or contact support');
    }
    sendsToday = sameWindow ? existing.sendsToday + 1 : 1;
    windowStartedAt = sameWindow ? existing.windowStartedAt : now;
  }

  const code = generateCode();
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS);
  await OneTimeCode.updateOne(
    { userId, purpose },
    { $set: { target, codeHash: hashCode(purpose, String(userId), code), attempts: 0, sentAt: now, expiresAt, sendsToday, windowStartedAt } },
    { upsert: true },
  );
  return { code, sentAt: now, expiresAt };
}

function invalid(code: string, message: string): AppError {
  return AppError.unprocessable(message, { code, fields: { code: message } });
}

/**
 * Checks a code without consuming it. Wrong guesses count against the code;
 * the fifth locks it until a new one is sent.
 */
export async function checkCode(userId: Types.ObjectId | string, purpose: CodePurpose, code: string, target?: string): Promise<OneTimeCodeDoc> {
  const record = await OneTimeCode.findOne({ userId, purpose }).lean<OneTimeCodeDoc>();
  if (!record || record.expiresAt.getTime() < Date.now() || (target !== undefined && record.target !== target)) {
    throw invalid('CODE_EXPIRED', 'This code has expired — send a new one');
  }
  if (record.attempts >= MAX_ATTEMPTS) throw invalid('TOO_MANY_ATTEMPTS', 'Too many wrong tries — send a new code');

  if (!codeMatches(purpose, String(userId), code, record.codeHash)) {
    await OneTimeCode.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
    const left = MAX_ATTEMPTS - record.attempts - 1;
    throw invalid('INVALID_CODE', left > 0 ? `That code isn't right — ${left} ${left === 1 ? 'try' : 'tries'} left` : 'Too many wrong tries — send a new code');
  }
  return record;
}

export async function consumeCode(record: Pick<OneTimeCodeDoc, '_id'>): Promise<void> {
  await OneTimeCode.deleteOne({ _id: record._id });
}

export async function pendingCode(userId: Types.ObjectId | string, purpose: CodePurpose): Promise<OneTimeCodeDoc | null> {
  return OneTimeCode.findOne({ userId, purpose }).lean<OneTimeCodeDoc>();
}

export function resendAtFor(sentAt: Date): string {
  return new Date(sentAt.getTime() + RESEND_COOLDOWN_MS).toISOString();
}
