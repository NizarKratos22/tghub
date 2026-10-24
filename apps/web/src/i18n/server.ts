import { cookies, headers } from 'next/headers';
import { isLocale, LOCALE_COOKIE, negotiate, type Locale } from './config';
import { DICTIONARIES, type Dictionary } from './dictionaries';

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
