'use client';

import type { ClanRole, CountryCode, GameSummary } from '@tgh/shared';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useLocale, useT } from '@/i18n/I18nProvider';
import { countryName } from '@/i18n/places';
import { api } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import styles from './squads.module.css';

export const SQUAD_KEYS = {
  lfg: ['lfg'] as const,
  lfgList: (query: object) => ['lfg', 'list', query] as const,
  lfgPost: (id: string) => ['lfg', 'post', id] as const,
  lfgRequests: (id: string) => ['lfg', 'requests', id] as const,
  clans: ['clans'] as const,
  clanList: (query: object) => ['clans', 'list', query] as const,
  clan: (tag: string) => ['clans', 'detail', tag] as const,
  myClan: ['clans', 'mine'] as const,
};

/** The whole catalogue for game pickers, cached for the session. */
export function useGameOptions(): GameSummary[] {
  const games = useQuery({ queryKey: ['games', 'all'], queryFn: () => api.games.list({ pageSize: 48, sort: 'title' }), staleTime: 10 * 60_000 });
  return games.data?.items ?? [];
}

/** A clan's mark: its tag set in condensed type on the clan colour. */
export function ClanEmblem({ tag, color, size = 48, className }: { tag: string; color: string; size?: number; className?: string }) {
  return (
    <span
      className={cx(styles.emblem, className)}
      style={{ '--clan': color, width: size, height: size, fontSize: size * (tag.length > 3 ? 0.3 : 0.38) } as CSSProperties}
      aria-hidden
    >
      {tag}
    </span>
  );
}

/** "[TAG]" chip next to a player's name; links to the clan. */
export function ClanTag({ tag, className }: { tag: string; className?: string }) {
  return (
    <Link href={`/clans/${tag}`} className={cx(styles.clanTag, className)}>
      [{tag}]
    </Link>
  );
}

export function RoleBadge({ role }: { role: ClanRole }) {
  const t = useT();
  return <span className={cx(styles.role, styles[`role_${role}`])}>{t.labels.clanRole[role]}</span>;
}

/**
 * Country as a small code chip. Not a flag emoji: Windows renders those as
 * bare letters, so the chip looks the same on every device.
 */
export function Flag({ country }: { country: CountryCode | null }) {
  const locale = useLocale();
  if (!country) return null;
  return (
    <abbr className={styles.flag} title={countryName(country, locale)}>
      {country}
    </abbr>
  );
}

/** Teammates ↔ Clans switch at the top of both sections. */
export function SquadsTabs({ active }: { active: 'lfg' | 'clans' }) {
  const t = useT();
  return (
    <nav className={styles.tabs} aria-label={t.nav.squads}>
      <Link href="/squads" className={cx(styles.tab, active === 'lfg' && styles.tabOn)} aria-current={active === 'lfg' ? 'page' : undefined}>
        {t.squads.tabTeammates}
      </Link>
      <Link href="/clans" className={cx(styles.tab, active === 'clans' && styles.tabOn)} aria-current={active === 'clans' ? 'page' : undefined}>
        {t.squads.tabClans}
      </Link>
    </nav>
  );
}
