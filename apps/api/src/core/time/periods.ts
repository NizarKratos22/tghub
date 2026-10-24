/**
 * Mission periods follow Tunisian local time, so "daily" resets at midnight in
 * Tunis regardless of where the server runs.
 */
const TIME_ZONE = 'Africa/Tunis';
const DAY_MS = 86_400_000;

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function parseDayKey(key: string): [number, number, number] {
  const [year = 1970, month = 1, day = 1] = key.split('-').map(Number);
  return [year, month, day];
}

/** Minutes the local zone is ahead of UTC at `date`. */
function zoneOffsetMinutes(date: Date): number {
  const parts = Object.fromEntries(partsFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - date.getTime()) / 60_000);
}

const readableFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** "Sat 08 Nov, 18:00" in Tunis time — for alert copy. */
export function formatTunis(date: Date): string {
  return readableFormatter.format(date);
}

/** YYYY-MM-DD in Tunis. */
export function dayKey(date = new Date()): string {
  return dayFormatter.format(date);
}

/** ISO-8601 week, e.g. 2026-W43. */
export function weekKey(date = new Date()): string {
  const [year, month, day] = parseDayKey(dayKey(date));
  const cursor = new Date(Date.UTC(year, month - 1, day));
  const weekday = cursor.getUTCDay() || 7;
  cursor.setUTCDate(cursor.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(cursor.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((cursor.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${cursor.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function startOfLocalDay(date = new Date()): Date {
  const [year, month, day] = parseDayKey(dayKey(date));
  return new Date(Date.UTC(year, month - 1, day) - zoneOffsetMinutes(date) * 60_000);
}

export function nextDailyReset(date = new Date()): Date {
  return new Date(startOfLocalDay(date).getTime() + DAY_MS);
}

/** Weeks reset on Monday 00:00 local time. */
export function nextWeeklyReset(date = new Date()): Date {
  const [year, month, day] = parseDayKey(dayKey(date));
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay() || 7;
  return new Date(startOfLocalDay(date).getTime() + (8 - weekday) * DAY_MS);
}
