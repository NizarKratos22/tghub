'use client';

import { CLAN_JOIN_POLICY_META, MAX_CLAN_MEMBERS, type ClanListQuery, type ClanSummary } from '@tgh/shared';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type CSSProperties } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, Pagination, Skeleton } from '@/components/ui/primitives';
import { useSession } from '@/features/auth/session';
import { api } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { formatNumber } from '@/lib/format';
import { ClanEmblem, Flag, RoleBadge, SQUAD_KEYS, useGameOptions } from './shared';
import styles from './ClanDirectory.module.css';

const SORT_LABELS: Record<ClanListQuery['sort'], string> = {
  season: 'Season XP',
  xp: 'All-time XP',
  members: 'Most members',
  new: 'Newest',
};
const PAGE_SIZE = 20;

function MyClanBar() {
  const { data: me } = useSession();
  const mine = useQuery({ queryKey: SQUAD_KEYS.myClan, queryFn: api.clans.mine, enabled: Boolean(me) });
  const clan = mine.data?.clan;
  if (!me || mine.isPending) return null;
  if (!clan) {
    return (
      <div className={styles.startCard}>
        <span className={styles.startIcon}>
          <Icon name="shield" size={22} />
        </span>
        <div>
          <strong>Start your own clan</strong>
          <span>Pick a tag, recruit your squad, and climb the season standings together.</span>
        </div>
        <ButtonLink href="/clans/new" icon="plus">
          Create a clan
        </ButtonLink>
      </div>
    );
  }
  return (
    <Link href={`/clans/${clan.tag}`} className={styles.myClan}>
      <ClanEmblem tag={clan.tag} color={clan.color} size={44} />
      <span className={styles.myClanText}>
        <span className={styles.myClanLabel}>Your clan</span>
        <strong>{clan.name}</strong>
      </span>
      <RoleBadge role={clan.role} />
      <Icon name="chevronRight" size={18} />
    </Link>
  );
}

function ClanRow({ clan, rank }: { clan: ClanSummary; rank: number | null }) {
  const policy = CLAN_JOIN_POLICY_META[clan.joinPolicy];
  const full = clan.memberCount >= MAX_CLAN_MEMBERS;
  return (
    <li>
      <Link href={`/clans/${clan.tag}`} className={cx(styles.row, rank !== null && rank <= 3 && styles[`podium${rank}`])}>
        <span className={styles.rank}>{rank ?? '—'}</span>
        <ClanEmblem tag={clan.tag} color={clan.color} size={48} />
        <span className={styles.identity}>
          <span className={styles.name}>
            {clan.name} <span className={styles.tag}>[{clan.tag}]</span> <Flag country={clan.country} />
          </span>
          {clan.description ? <span className={styles.description}>{clan.description}</span> : null}
          <span className={styles.games}>
            {clan.games.map((game) => (
              <span key={game.id} className={styles.game} style={{ '--accent': game.accent } as CSSProperties} title={game.title}>
                {game.monogram}
              </span>
            ))}
          </span>
        </span>
        <span className={styles.stat}>
          <strong>
            {clan.memberCount}
            <small>/{MAX_CLAN_MEMBERS}</small>
          </strong>
          <span>members</span>
        </span>
        <span className={cx(styles.stat, styles.statXp)}>
          <strong>{formatNumber(clan.seasonXp)}</strong>
          <span>season XP</span>
        </span>
        <span className={cx(styles.policy, styles[`policy_${full ? 'closed' : clan.joinPolicy}`])}>{full ? 'Full' : policy.label}</span>
      </Link>
    </li>
  );
}

/** Directory and season standings in one list — sorted by season XP, it is the leaderboard. */
export function ClanDirectory() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const games = useGameOptions();
  const [search, setSearch] = useState(params.get('q') ?? '');

  const query = {
    q: params.get('q') ?? undefined,
    gameId: params.get('game') ?? undefined,
    recruiting: params.get('recruiting') === 'true' ? 'true' : undefined,
    sort: (params.get('sort') as ClanListQuery['sort'] | null) ?? 'season',
    page: Number(params.get('page') ?? 1) || 1,
  };
  const clans = useQuery({ queryKey: SQUAD_KEYS.clanList(query), queryFn: () => api.clans.list(query) });

  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  };

  // Search as you type, without a request per keystroke.
  useEffect(() => {
    const value = search.trim() || undefined;
    if (value === query.q) return;
    const timer = setTimeout(() => setParam('q', value), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const ranked = query.sort !== 'new' && !query.q && !query.gameId && !query.recruiting;
  const offset = (query.page - 1) * PAGE_SIZE;
  const hrefFor = (page: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(page));
    return `${pathname}?${next}`;
  };

  return (
    <div className={styles.directory}>
      <MyClanBar />

      <div className={styles.filters}>
        <label className={styles.search}>
          <Icon name="search" size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clans or tags" aria-label="Search clans" />
        </label>
        <select className={styles.select} value={query.gameId ?? ''} onChange={(e) => setParam('game', e.target.value || undefined)} aria-label="Game">
          <option value="">All games</option>
          {games.map((game) => (
            <option key={game.id} value={game.id}>
              {game.title}
            </option>
          ))}
        </select>
        <button type="button" className={cx(styles.toggle, query.recruiting && styles.toggleOn)} onClick={() => setParam('recruiting', query.recruiting ? undefined : 'true')} aria-pressed={Boolean(query.recruiting)}>
          <Icon name="users" size={15} /> Recruiting
        </button>
        <label className={styles.sort}>
          Sort
          <select className={styles.select} value={query.sort} onChange={(e) => setParam('sort', e.target.value === 'season' ? undefined : e.target.value)}>
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {clans.isPending ? (
        <div className={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={84} />
          ))}
        </div>
      ) : (clans.data?.items.length ?? 0) === 0 ? (
        <EmptyState icon="shield" title={query.q || query.gameId || query.recruiting ? 'No clans match' : 'No clans yet'} action={<ButtonLink href="/clans/new" icon="plus">Create the first one</ButtonLink>}>
          Clans pool their members&rsquo; XP and race the season standings.
        </EmptyState>
      ) : (
        <>
          <ol className={styles.list}>
            {clans.data!.items.map((clan, index) => (
              <ClanRow key={clan.id} clan={clan} rank={ranked ? offset + index + 1 : null} />
            ))}
          </ol>
          <Pagination page={clans.data!.page} totalPages={clans.data!.totalPages} hrefFor={hrefFor} />
        </>
      )}
    </div>
  );
}
