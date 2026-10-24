import { createHash } from 'node:crypto';
import { model, Schema, type Types } from 'mongoose';
import { logger } from '../logger';

/**
 * Self-hosted error tracking: crashes from the API and the web app, grouped
 * by fingerprint so a recurring bug is one row with a count, not a flood.
 * A resolved error that happens again reopens itself (a regression).
 */
export interface ErrorEventDoc {
  _id: Types.ObjectId;
  fingerprint: string;
  source: 'api' | 'web';
  name: string;
  message: string;
  stack: string | null;
  /** Route or page where it last happened. */
  where: string | null;
  count: number;
  /** Players affected recently (capped), for "how many people hit this". */
  userIds: Types.ObjectId[];
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolvedAt: Date | null;
}

const errorEventSchema = new Schema<ErrorEventDoc>({
  fingerprint: { type: String, required: true, unique: true },
  source: { type: String, enum: ['api', 'web'], required: true },
  name: { type: String, default: 'Error' },
  message: { type: String, required: true },
  stack: { type: String, default: null },
  where: { type: String, default: null },
  count: { type: Number, default: 0 },
  userIds: { type: [Schema.Types.ObjectId], default: [] },
  firstSeenAt: { type: Date, required: true },
  lastSeenAt: { type: Date, required: true },
  resolvedAt: { type: Date, default: null },
});

errorEventSchema.index({ resolvedAt: 1, lastSeenAt: -1 });

export const ErrorEvent = model<ErrorEventDoc>('ErrorEvent', errorEventSchema, 'error_events');

const MAX_STACK = 4_000;
const MAX_MESSAGE = 500;
const MAX_USERS = 50;

/**
 * Numbers, ids and quoted values vary between occurrences of the same bug;
 * strip them so they group together.
 */
export function normalizeMessage(message: string): string {
  return message
    .replace(/[a-f\d]{24}/gi, '<id>')
    .replace(/\b\d+(\.\d+)?\b/g, '<n>')
    .replace(/(["'`]).*?\1/g, '<value>')
    .slice(0, MAX_MESSAGE);
}

/** The first stack frame that points into our own code, without line/column noise from rebuilds. */
function topFrame(stack: string | null | undefined): string {
  const frame = stack?.split('\n').find((line) => line.trim().startsWith('at ') && !line.includes('node_modules'));
  return frame?.replace(/:\d+:\d+\)?$/, '').trim() ?? '';
}

export function fingerprintOf(source: string, name: string, message: string, stack?: string | null): string {
  return createHash('sha1').update(`${source}|${name}|${normalizeMessage(message)}|${topFrame(stack)}`).digest('hex');
}

export interface ErrorReport {
  source: 'api' | 'web';
  name?: string;
  message: string;
  stack?: string | null;
  where?: string | null;
  userId?: string | null;
}

/** Never throws: a broken error logger must not take the request down with it. */
export async function recordError(report: ErrorReport): Promise<void> {
  try {
    const name = (report.name || 'Error').slice(0, 80);
    const message = report.message.slice(0, MAX_MESSAGE) || 'Unknown error';
    const now = new Date();
    await ErrorEvent.updateOne(
      { fingerprint: fingerprintOf(report.source, name, message, report.stack) },
      {
        $inc: { count: 1 },
        $set: { message, stack: report.stack?.slice(0, MAX_STACK) ?? null, where: report.where?.slice(0, 300) ?? null, lastSeenAt: now, resolvedAt: null },
        $setOnInsert: { source: report.source, name, firstSeenAt: now },
        ...(report.userId && /^[a-f\d]{24}$/i.test(report.userId) ? { $addToSet: { userIds: report.userId } } : {}),
      },
      { upsert: true },
    );
    // Keep the affected-players list bounded.
    await ErrorEvent.updateOne(
      { fingerprint: fingerprintOf(report.source, name, message, report.stack), [`userIds.${MAX_USERS}`]: { $exists: true } },
      { $push: { userIds: { $each: [], $slice: -MAX_USERS } } },
    );
  } catch (error) {
    logger.warn({ err: error }, 'Could not record error event');
  }
}
