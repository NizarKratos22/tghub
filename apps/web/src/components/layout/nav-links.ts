import type { IconName } from '@/components/ui/Icon';
import type { Dictionary } from '@/i18n/dictionaries';

/** The site's main sections — the header links, the phone drawer and quick search's "Jump to". */
export const NAV_LINKS: Array<{ href: string; label: keyof Dictionary['nav']; icon: IconName; also?: string[] }> = [
  { href: '/radar', label: 'radar', icon: 'radar' },
  { href: '/games', label: 'games', icon: 'gamepad' },
  { href: '/guides', label: 'guides', icon: 'map' },
  { href: '/tournaments', label: 'tournaments', icon: 'trophy' },
  { href: '/squads', label: 'squads', icon: 'users', also: ['/clans'] },
  { href: '/market', label: 'market', icon: 'store' },
  { href: '/pc', label: 'pc', icon: 'cpu' },
  { href: '/universe', label: 'universe', icon: 'star' },
];
