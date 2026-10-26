import { fill, INTL_LOCALE, type Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries/en';
import { en } from '@/i18n/dictionaries/en';

/** Dates read in Tunis time, on a 24-hour clock, whatever the language. */
const TIME_ZONE = 'Africa/Tunis';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Every date, number and price on the site goes through one of these, so a
 * language switch changes them all. Client components get one from `useFormat()`,
 * Server Components from `getFormat()`.
 */
export function createFormat(locale: Locale, words: Dictionary['time']) {
  const tag = INTL_LOCALE[locale];
  const dates = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, { timeZone: TIME_ZONE, hourCycle: 'h23', ...options });

  const dateFormatter = dates({ day: '2-digit', month: 'short' });
  const dateYearFormatter = dates({ day: '2-digit', month: 'short', year: 'numeric' });
  const dateTimeFormatter = dates({ weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const timeFormatter = dates({ hour: '2-digit', minute: '2-digit' });
  const weekdayFormatter = dates({ weekday: 'short' });
  const monthFormatter = dates({ month: 'short' });
  const dayFormatter = dates({ day: '2-digit' });
  const numberFormatter = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
  const listFormatter = new Intl.ListFormat(tag, { type: 'conjunction' });
  /** French abbreviations end in a dot ("sam.", "oct."); calendar tiles read better without it. */
  const tilePart = (text: string) => text.replace(/\.$/, '').toLocaleUpperCase(tag);

  const date = (iso: string) => dateFormatter.format(new Date(iso));
  /** `fill()` with this language's plural rules. */
  const say = (template: string, values: Record<string, string | number>) => fill(template, values, locale);

  return {
    locale,
    fill: say,
    date,
    dateYear: (iso: string) => dateYearFormatter.format(new Date(iso)),
    dateTime: (iso: string) => dateTimeFormatter.format(new Date(iso)),
    time: (iso: string) => timeFormatter.format(new Date(iso)),
    number: (value: number) => numberFormatter.format(value),
    /** "processor, memory and storage" in the player's language. */
    list: (items: string[]) => listFormatter.format(items),

    /** Calendar tile parts: { weekday: "SAT", month: "NOV", day: "08", time: "18:00" }. */
    dateTile(iso: string) {
      const value = new Date(iso);
      return {
        weekday: tilePart(weekdayFormatter.format(value)),
        month: tilePart(monthFormatter.format(value)),
        day: dayFormatter.format(value),
        time: timeFormatter.format(value),
      };
    },

    /** Store prices in their own currency (Radar deals), or "Free". */
    price(amount: number, currency: string): string {
      if (amount === 0) return words.free;
      return new Intl.NumberFormat(tag, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
    },

    /** Marketplace prices are whole dinars: "1,350 TND", or "Free". */
    tnd: (amount: number): string => (amount === 0 ? words.free : say(words.tnd, { amount: numberFormatter.format(amount) })),

    /** "just now", "5m ago", "3h ago", "2d ago", then the date. */
    relative(iso: string, now = Date.now()): string {
      const diff = now - new Date(iso).getTime();
      if (diff < MINUTE) return words.justNow;
      if (diff < HOUR) return say(words.minutesAgo, { n: Math.floor(diff / MINUTE) });
      if (diff < DAY) return say(words.hoursAgo, { n: Math.floor(diff / HOUR) });
      if (diff < 7 * DAY) return say(words.daysAgo, { n: Math.floor(diff / DAY) });
      return date(iso);
    },

    /** "2d 04h", "3h 12m", "8m" — or null once the moment has passed. */
    timeLeft(iso: string, now = Date.now()): string | null {
      const diff = new Date(iso).getTime() - now;
      if (diff <= 0) return null;
      const days = Math.floor(diff / DAY);
      const hours = Math.floor((diff % DAY) / HOUR);
      const minutes = Math.floor((diff % HOUR) / MINUTE);
      if (days > 0) return say(words.leftDays, { d: days, h: String(hours).padStart(2, '0') });
      if (hours > 0) return say(words.leftHours, { h: hours, m: String(minutes).padStart(2, '0') });
      return say(words.leftMinutes, { m: Math.max(1, minutes) });
    },
  };
}

export type Format = ReturnType<typeof createFormat>;

/** English formatting for the admin console, which stays in English. */
const english = createFormat('en', en.time);
export const formatDate = english.date;
export const formatDateYear = english.dateYear;
export const formatDateTime = english.dateTime;
export const formatTime = english.time;
export const formatNumber = english.number;
export const formatTnd = english.tnd;
export const relativeTime = english.relative;

export const isUrgent = (iso: string, now = Date.now()) => {
  const diff = new Date(iso).getTime() - now;
  return diff > 0 && diff < DAY;
};

export const isExternal = (url: string) => /^https?:\/\//.test(url);
