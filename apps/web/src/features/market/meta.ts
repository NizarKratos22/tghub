import type { ListingCard, MarketCategory } from '@tgh/shared';
import { fill } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { regionName } from '@/i18n/places';
import type { IconName } from '@/components/ui/Icon';

export const CATEGORY_ICONS: Record<MarketCategory, IconName> = {
  fivem: 'code',
  mods: 'layers',
  'gaming-pcs': 'tower',
  'pc-parts': 'cpu',
  consoles: 'gamepad',
  peripherals: 'keyboard',
  setup: 'monitor',
  games: 'disc',
  other: 'box',
};

/** Shown under the title on cards: where it is, or what it runs on. */
export function listingSubline(
  listing: Pick<ListingCard, 'digital' | 'region' | 'framework' | 'subcategory' | 'category' | 'condition'>,
  t: Dictionary,
): string {
  if (listing.digital) {
    const kind = categoryLabel(listing, t);
    return listing.framework ? `${t.labels.framework[listing.framework]} · ${kind}` : fill(t.marketBrowse.digitalKind, { kind });
  }
  return [listing.region ? regionName(listing.region, t) : null, listing.condition ? t.labels.condition[listing.condition] : null].filter(Boolean).join(' · ');
}

export function categoryLabel(listing: Pick<ListingCard, 'category' | 'subcategory'>, t: Dictionary): string {
  return listing.subcategory ? t.labels.subcategory[listing.subcategory] : t.market.categoryNames[listing.category];
}

export const LISTING_KEYS = {
  viewer: (id: string) => ['market', 'viewer', id] as const,
  mine: ['market', 'mine'] as const,
  saved: ['market', 'saved'] as const,
  savedIds: ['bookmarks', 'listing'] as const,
  conversations: (role: string) => ['market', 'conversations', role] as const,
  conversation: (id: string) => ['market', 'conversation', id] as const,
  messages: (id: string) => ['market', 'messages', id] as const,
};
