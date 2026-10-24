import {
  FIVEM_FRAMEWORK_LABELS,
  MARKET_CATEGORY_META,
  MARKET_CONDITION_LABELS,
  MARKET_SUBCATEGORY_LABELS,
  type ListingCard,
  type MarketCategory,
} from '@tgh/shared';
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
export function listingSubline(listing: Pick<ListingCard, 'digital' | 'region' | 'framework' | 'subcategory' | 'category' | 'condition'>): string {
  if (listing.digital) {
    const kind = listing.subcategory ? MARKET_SUBCATEGORY_LABELS[listing.subcategory] : MARKET_CATEGORY_META[listing.category].label;
    return listing.framework ? `${FIVEM_FRAMEWORK_LABELS[listing.framework]} · ${kind}` : `Digital · ${kind}`;
  }
  return [listing.region, listing.condition ? MARKET_CONDITION_LABELS[listing.condition] : null].filter(Boolean).join(' · ');
}

export function categoryLabel(listing: Pick<ListingCard, 'category' | 'subcategory'>): string {
  return listing.subcategory ? MARKET_SUBCATEGORY_LABELS[listing.subcategory] : MARKET_CATEGORY_META[listing.category].label;
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
