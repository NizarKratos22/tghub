import { cookies, headers } from 'next/headers';
import { isLocale, LOCALE_COOKIE, negotiate, type Locale } from './config';
import { DICTIONARIES, type Dictionary } from './dictionaries';
import { createFormat, type Format } from '@/lib/format';

/** The player's choice (cookie), else what the browser asks for. */
export async function getLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  return negotiate((await headers()).get('accept-language'));
}

/** Strings for Server Components: `const t = await getT(); t.nav.radar`. */
export async function getT(): Promise<Dictionary> {
  return DICTIONARIES[await getLocale()];
}

/** Dates, numbers and prices for Server Components, in the player's language. */
export async function getFormat(): Promise<Format> {
  const locale = await getLocale();
  return createFormat(locale, DICTIONARIES[locale].time);
}
