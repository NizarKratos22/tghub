import { AsyncLocalStorage } from 'node:async_hooks';
import type { NextFunction, Request, Response } from 'express';

export const LOCALES = ['en', 'fr', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

/** Set by the web app's language switch (apps/web/src/i18n/config.ts) and sent along through the /api/v1 proxy. */
const LOCALE_COOKIE = 'tgh_locale';

const isLocale = (value: unknown): value is Locale => typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

/** The player's language: the site's language cookie, else the browser's Accept-Language, else English. */
export function localeOf(req: Request): Locale {
  const chosen: unknown = req.cookies?.[LOCALE_COOKIE];
  if (isLocale(chosen)) return chosen;
  const accepted = req.acceptsLanguages(...LOCALES);
  return isLocale(accepted) ? accepted : 'en';
}

const storage = new AsyncLocalStorage<{ locale: Locale }>();

/** Keeps the request's language reachable from services (emails) without passing it through every call. */
export function requestContext(req: Request, _res: Response, next: NextFunction): void {
  storage.run({ locale: localeOf(req) }, next);
}

/** The current request's language; English outside a request (jobs, scripts, the seed). */
export function currentLocale(): Locale {
  return storage.getStore()?.locale ?? 'en';
}
