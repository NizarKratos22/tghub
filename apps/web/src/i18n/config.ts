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

/** "{count} listings" → "12 listings". Unknown keys stay as written. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
