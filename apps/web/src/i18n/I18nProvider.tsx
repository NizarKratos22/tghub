'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createFormat, type Format } from '@/lib/format';
import { LOCALE_COOKIE, type Locale } from './config';
import { DICTIONARIES, type Dictionary } from './dictionaries';

const I18nContext = createContext<{ locale: Locale; t: Dictionary; format: Format }>({
  locale: 'en',
  t: DICTIONARIES.en,
  format: createFormat('en', DICTIONARIES.en.time),
});

/** The root layout decides the locale on the server; client components read it from here. */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => ({ locale, t: DICTIONARIES[locale], format: createFormat(locale, DICTIONARIES[locale].time) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useT = (): Dictionary => useContext(I18nContext).t;
export const useLocale = (): Locale => useContext(I18nContext).locale;
/** Dates, numbers and prices in the player's language. */
export const useFormat = (): Format => useContext(I18nContext).format;

/** Saves the choice for a year and reloads, so direction, fonts and server-rendered text all switch together. */
export function switchLocale(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  window.location.reload();
}
