const TIME_ZONE = 'Africa/Tunis';

const dateFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, day: '2-digit', month: 'short' });
const dateYearFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const timeFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' });
const monthFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, month: 'short' });
const dayFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, day: '2-digit' });
const numberFormatter = new Intl.NumberFormat('en-US');

export const formatDate = (iso: string) => dateFormatter.format(new Date(iso));
export const formatDateYear = (iso: string) => dateYearFormatter.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFormatter.format(new Date(iso));
export const formatTime = (iso: string) => timeFormatter.format(new Date(iso));
export const formatNumber = (value: number) => numberFormatter.format(value);

const weekdayFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, weekday: 'short' });

/** Calendar tile parts: { weekday: "SAT", month: "NOV", day: "08", time: "18:00" }. */
export function dateTile(iso: string) {
  const date = new Date(iso);
  return {
    weekday: weekdayFormatter.format(date).toUpperCase(),
    month: monthFormatter.format(date).toUpperCase(),
    day: dayFormatter.format(date),
    time: timeFormatter.format(date),
  };
}

export function formatPrice(amount: number, currency: string): string {
  if (amount === 0) return 'Free';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}

const tndFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** Marketplace prices are whole dinars: "1,350 TND", or "Free". */
export function formatTnd(amount: number): string {
  return amount === 0 ? 'Free' : `${tndFormatter.format(amount)} TND`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return formatDate(iso);
}

/** "2d 04h", "3h 12m", "8m" — or null once the moment has passed. */
export function timeLeft(iso: string, now = Date.now()): string | null {
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return null;
  const days = Math.floor(diff / DAY);
  const hours = Math.floor((diff % DAY) / HOUR);
  const minutes = Math.floor((diff % HOUR) / MINUTE);
  if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${Math.max(1, minutes)}m`;
}

export const isUrgent = (iso: string, now = Date.now()) => {
  const diff = new Date(iso).getTime() - now;
  return diff > 0 && diff < DAY;
};

export const isExternal = (url: string) => /^https?:\/\//.test(url);
