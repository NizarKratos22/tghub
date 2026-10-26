export const LOCALES = ['en', 'fr', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'tgh_locale';

export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', fr: 'Français', ar: 'العربية' };

export const isLocale = (value: unknown): value is Locale => typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

export const directionOf = (locale: Locale): 'ltr' | 'rtl' => (locale === 'ar' ? 'rtl' : 'ltr');

/** Picks the best supported language from an Accept-Language header. */
export function negotiate(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { tag: (tag ?? '').toLowerCase().slice(0, 2), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  return ranked.find((entry) => isLocale(entry.tag))?.tag as Locale | undefined ?? DEFAULT_LOCALE;
}

/** Tunisian conventions in every language: Latin digits, also in Arabic. */
export const INTL_LOCALE: Record<Locale, string> = { en: 'en-GB', fr: 'fr-FR', ar: 'ar-TN-u-nu-latn' };

const PLURAL_BLOCK = /\{(\w+),\s*plural,\s*((?:[^{}]|\{[^{}]*\})*)\}/g;
const PLURAL_CASE = /(=\d+|zero|one|two|few|many|other)\s*\{([^{}]*)\}/g;
const pluralRules = new Map<Locale, Intl.PluralRules>();
const counters = new Map<Locale, Intl.NumberFormat>();

function pluralForm(locale: Locale, count: number, cases: string): string {
  const forms: Record<string, string> = {};
  for (const [, key, text] of cases.matchAll(PLURAL_CASE)) forms[key!] = text!;
  if (!pluralRules.has(locale)) pluralRules.set(locale, new Intl.PluralRules(INTL_LOCALE[locale]));
  if (!counters.has(locale)) counters.set(locale, new Intl.NumberFormat(INTL_LOCALE[locale]));
  const chosen = forms[`=${count}`] ?? forms[pluralRules.get(locale)!.select(count)] ?? forms.other ?? '';
  return chosen.replace(/#/g, counters.get(locale)!.format(count));
}

/**
 * "{count} listings" → "12 listings". Counted words use ICU plural blocks so
 * each language picks its own forms — Arabic has six:
 * "{count, plural, one {# rating} other {# ratings}}", where "#" is the number.
 * Unknown keys stay as written.
 */
export function fill(template: string, values: Record<string, string | number>, locale: Locale = DEFAULT_LOCALE): string {
  return template
    .replace(PLURAL_BLOCK, (match, key: string, cases: string) => {
      const count = Number(values[key]);
      return key in values && Number.isFinite(count) ? pluralForm(locale, count, cases) : match;
    })
    .replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
