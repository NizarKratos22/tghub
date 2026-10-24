'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { LOCALE_COOKIE, type Locale } from './config';
import { DICTIONARIES, type Dictionary } from './dictionaries';

const I18nContext = createContext<{ locale: Locale; t: Dictionary }>({ locale: 'en', t: DICTIONARIES.en });

/** The root layout decides the locale on the server; client components read it from here. */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, t: DICTIONARIES[locale] }}>{children}</I18nContext.Provider>;
}

export const useT = (): Dictionary => useContext(I18nContext).t;
export const useLocale = (): Locale => useContext(I18nContext).locale;

/** Saves the choice for a year and reloads, so direction, fonts and server-rendered text all switch together. */
export function switchLocale(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  window.location.reload();
}
