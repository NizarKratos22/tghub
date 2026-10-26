import type { Role } from '@tgh/shared';
import type { IconName } from '@/components/ui/Icon';

export interface AdminNavItem {
  href: string;
  label: string;
  icon: IconName;
  description: string;
  /** Who may open it. Moderators handle marketplace reports; everything else is admin-only. */
  roles: Role[];
  /** Overview counter shown as a badge next to the label. */
  badge?: 'flaggedListings' | 'failingSources';
}

export const ADMIN_NAV: Array<{ title: string | null; items: AdminNavItem[] }> = [
  {
    title: null,
    items: [{ href: '/admin', label: 'Overview', icon: 'grid', description: 'Platform health at a glance.', roles: ['admin'] }],
  },
  {
    title: 'Community',
    items: [
      { href: '/admin/marketplace', label: 'Marketplace', icon: 'store', description: 'Reported listings and moderation decisions.', roles: ['admin', 'moderator'], badge: 'flaggedListings' },
      { href: '/admin/users', label: 'Players', icon: 'users', description: 'Search accounts, change roles, suspend.', roles: ['admin'] },
      { href: '/admin/payments', label: 'Payments', icon: 'tag', description: 'Featured-listing orders and revenue.', roles: ['admin'] },
      { href: '/admin/missions', label: 'Missions & XP', icon: 'star', description: 'Missions, achievements, seasons and manual XP.', roles: ['admin'] },
    ],
  },
  {
    title: 'Content',
    items: [
      { href: '/admin/games', label: 'Games', icon: 'gamepad', description: 'The catalogue, filled from IGDB.', roles: ['admin'] },
      { href: '/admin/guides', label: 'Guides', icon: 'map', description: 'Competitive guides and the Overwolf apps for each game.', roles: ['admin'] },
      { href: '/admin/content', label: 'Radar content', icon: 'radar', description: 'Add news, deals, guides and events by hand.', roles: ['admin'] },
      { href: '/admin/tournaments', label: 'Tournaments', icon: 'trophy', description: 'Platforms, discovery sources, imports and moderation.', roles: ['admin'] },
    ],
  },
  {
    title: 'Alerts',
    items: [
      { href: '/admin/alerts', label: 'Announcements', icon: 'bell', description: 'Publish alerts and follow their delivery.', roles: ['admin'] },
      { href: '/admin/sources', label: 'Sources', icon: 'refresh', description: 'Official feeds that create alerts automatically.', roles: ['admin'], badge: 'failingSources' },
      { href: '/admin/discord', label: 'Discord', icon: 'send', description: 'Webhook channels that receive alerts.', roles: ['admin'] },
    ],
  },
  {
    title: 'Platform',
    items: [{ href: '/admin/errors', label: 'Errors', icon: 'alert', description: 'Crashes from the API and the web app, grouped.', roles: ['admin'] }],
  },
];

export const ADMIN_ITEMS = ADMIN_NAV.flatMap((group) => group.items);

export function adminItemFor(pathname: string): AdminNavItem | undefined {
  // Longest match wins so /admin/users doesn't resolve to /admin.
  return [...ADMIN_ITEMS].sort((a, b) => b.href.length - a.href.length).find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

export function canOpen(item: AdminNavItem, role: Role): boolean {
  return item.roles.includes(role);
}
