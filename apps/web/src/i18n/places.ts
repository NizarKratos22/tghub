import { countryName as englishCountryName, type TnRegion } from '@tgh/shared';
import { fill, INTL_LOCALE, type Locale } from './config';
import type { Dictionary } from './dictionaries';

const displayNames = new Map<Locale, Intl.DisplayNames>();

/**
 * Names that Node and browsers spell differently (their built-in ICU data
 * differs), pinned so server-rendered pages match. The short forms are the
 * ones players use.
 */
const PINNED: Partial<Record<Locale, Record<string, string>>> = {
  fr: { PS: 'Palestine', HK: 'Hong Kong', MO: 'Macao', FK: 'Îles Malouines' },
  ar: { PS: 'فلسطين', HK: 'هونغ كونغ', MO: 'مكاو', FK: 'جزر فوكلاند' },
};

/** "Germany" · "Allemagne" · "ألمانيا" — the platform's own country names, with the English list as the fallback. */
export function countryName(code: string, locale: Locale): string {
  if (locale === 'en') return englishCountryName(code);
  const pinned = PINNED[locale]?.[code];
  if (pinned) return pinned;
  try {
    if (!displayNames.has(locale)) displayNames.set(locale, new Intl.DisplayNames([INTL_LOCALE[locale]], { type: 'region' }));
    return displayNames.get(locale)!.of(code) ?? englishCountryName(code);
  } catch {
    return englishCountryName(code);
  }
}

/**
 * Alphabetical order that is the same on the server and in every browser.
 * localeCompare follows each runtime's own collation data, which differs
 * (Arabic most visibly) and made server-rendered lists mismatch on hydration.
 * Accents and other marks are folded, so "États-Unis" sorts under E.
 */
const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
export const byName = (a: string, b: string) => {
  const [x, y] = [fold(a), fold(b)];
  return x < y ? -1 : x > y ? 1 : 0;
};

/** Governorates are stored by their French/English name; Arabic shows its own. */
export const regionName = (region: string, t: Dictionary): string => t.labels.region[region as TnRegion] ?? region;

/** Level titles are a fixed ladder with local names; titles from achievements keep their own name. */
export const titleName = (title: string, t: Dictionary): string => (t.labels.levelTitle as Record<string, string | undefined>)[title] ?? title;

/** "Sfax, Tunisia" · "France" · null — in the player's language. */
export function placeName(place: { country: string | null; region: string | null }, t: Dictionary, locale: Locale): string | null {
  if (place.country === 'TN') {
    const region = place.region ? regionName(place.region, t) : null;
    // In Arabic the capital and the country share a name: "تونس" once, not "تونس، تونس".
    return region && region !== t.labels.tunisia ? fill(t.labels.place, { region, country: t.labels.tunisia }) : (region ?? t.labels.tunisia);
  }
  if (place.country) return countryName(place.country, locale);
  return place.region && place.region !== 'Abroad' ? regionName(place.region, t) : null;
}
