/**
 * Shared bookkeeping for anything that polls an upstream on an interval
 * (Steam news sources, tournament platforms): when it's due, how healthy it
 * is, and when to switch it off.
 */
export interface SourceHealthFields {
  enabled: boolean;
  intervalMinutes: number;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
  consecutiveFailures: number;
}

export type SourceHealth = 'healthy' | 'failing' | 'disabled' | 'pending';

/** A source failing this many runs in a row is disabled until an admin re-enables it. */
export const MAX_CONSECUTIVE_FAILURES = 5;

export function healthOf(source: SourceHealthFields): SourceHealth {
  if (!source.enabled) return 'disabled';
  if (source.consecutiveFailures > 0) return 'failing';
  return source.lastSuccessAt ? 'healthy' : 'pending';
}

export function isDue(source: SourceHealthFields, now = Date.now()): boolean {
  return source.enabled && (!source.lastRunAt || source.lastRunAt.getTime() + source.intervalMinutes * 60_000 <= now);
}

export function successUpdate(startedAt: Date, newItems: number) {
  return {
    $set: { lastRunAt: startedAt, lastSuccessAt: startedAt, lastError: null, consecutiveFailures: 0 },
    $inc: { itemsIngested: newItems },
  };
}

export function failureUpdate(source: SourceHealthFields, startedAt: Date, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const failures = source.consecutiveFailures + 1;
  return {
    $set: {
      lastRunAt: startedAt,
      lastError: message.slice(0, 300),
      consecutiveFailures: failures,
      ...(failures >= MAX_CONSECUTIVE_FAILURES ? { enabled: false } : {}),
    },
  };
}
