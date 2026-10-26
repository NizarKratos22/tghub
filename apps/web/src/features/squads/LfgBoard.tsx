'use client';

import { LFG_LANGUAGES, PLATFORMS, type LfgLanguage, type LfgPost, type Platform } from '@tgh/shared';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { CSSProperties } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Avatar, EmptyState, Pagination, Skeleton } from '@/components/ui/primitives';
import { Countdown } from '@/components/ui/time';
import { useSession } from '@/features/auth/session';
import { fill } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { useFormat, useT } from '@/i18n/I18nProvider';
import type { Format } from '@/lib/format';
import { api } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { Flag, SQUAD_KEYS, useGameOptions } from './shared';
import styles from './LfgBoard.module.css';

function spotsLabel(post: LfgPost, t: Dictionary, format: Format) {
  const left = post.slots - post.filled;
  if (post.status === 'full' || left <= 0) return t.lfg.squadFull;
  return format.fill(t.lfg.spotsLeft, { count: left });
}

/** What the viewer can do with a post, shown as the card's call to action. */
function CardAction({ post }: { post: LfgPost }) {
  const t = useT();
  if (post.viewer.isAuthor) {
    return (
      <span className={cx(styles.cta, post.pendingRequests > 0 && styles.ctaAlert)}>
        {post.pendingRequests > 0 ? fill(t.lfg.waiting, { count: post.pendingRequests }) : t.lfg.yourPost}
      </span>
    );
  }
  if (post.viewer.request === 'accepted') return <span className={cx(styles.cta, styles.ctaIn)}>{t.lfg.youreIn}</span>;
  if (post.viewer.request === 'pending') return <span className={styles.cta}>{t.lfg.requested}</span>;
  if (post.status !== 'open') return <span className={styles.cta}>{t.lfg.closed}</span>;
  return <span className={cx(styles.cta, styles.ctaJoin)}>{t.lfg.askToJoin}</span>;
}

export function LfgCard({ post }: { post: LfgPost }) {
  const t = useT();
  const format = useFormat();
  return (
    <Link href={`/squads/${post.id}`} className={cx(styles.card, post.status !== 'open' && styles.cardMuted)} style={{ '--accent': post.game.accent } as CSSProperties}>
      <span className={styles.band}>
        <span className={styles.monogram} aria-hidden>
          {post.game.monogram}
        </span>
        <span className={styles.bandText}>
          <span className={styles.gameTitle}>{post.game.title}</span>
          <span className={styles.platform}>{t.labels.platform[post.platform]}</span>
        </span>
        <span className={styles.seats}>
          <span className={styles.slots} aria-hidden>
            {Array.from({ length: post.slots }, (_, i) => (
              <span key={i} className={cx(styles.slot, i < post.filled && styles.slotFilled)} />
            ))}
          </span>
          <span className={styles.seatsLabel}>{spotsLabel(post, t, format)}</span>
        </span>
      </span>

      <span className={styles.body}>
        <span className={styles.mode}>
          {post.mode}
          {post.rank ? <span className={styles.rank}>{post.rank}</span> : null}
        </span>
        {post.note ? <span className={styles.note} dir="auto">{post.note}</span> : null}
        <span className={styles.chips}>
          {post.languages.map((language) => (
            <span key={language} className={styles.chip}>
              {t.labels.lfgLanguage[language]}
            </span>
          ))}
          {post.micRequired ? (
            <span className={cx(styles.chip, styles.chipMic)}>
              <Icon name="headset" size={12} /> {t.lfg.mic}
            </span>
          ) : null}
        </span>
      </span>

      <span className={styles.foot}>
        <span className={styles.author}>
          <Avatar name={post.author.displayName} color={post.author.avatarColor} src={post.author.avatarUrl} size={30} />
          <span className={styles.authorText}>
            <span className={styles.authorName}>
              {post.author.clanTag ? <span className={styles.authorClan}>[{post.author.clanTag}]</span> : null}
              {post.author.displayName}
            </span>
            <span className={styles.authorMeta}>
              {fill(t.common.levelShort, { level: post.author.level })} <Flag country={post.author.country} />
              <span aria-hidden>·</span>
              {post.status === 'open' ? <Countdown iso={post.expiresAt} label={t.lfg.closesIn} endedLabel={t.lfg.closedLower} /> : t.lfg.closedLower}
            </span>
          </span>
        </span>
        <CardAction post={post} />
      </span>
    </Link>
  );
}

function FilterChips<T extends string>({ label, options, labels, value, onChange }: { label: string; options: readonly T[]; labels: Record<T, string>; value: T | undefined; onChange: (value: T | undefined) => void }) {
  const t = useT();
  return (
    <div className={styles.filterGroup} role="group" aria-label={label}>
      <span className={styles.filterLabel}>{label}</span>
      <button type="button" className={cx(styles.filterChip, !value && styles.filterOn)} onClick={() => onChange(undefined)} aria-pressed={!value}>
        {t.common.all}
      </button>
      {options.map((option) => (
        <button key={option} type="button" className={cx(styles.filterChip, value === option && styles.filterOn)} onClick={() => onChange(value === option ? undefined : option)} aria-pressed={value === option}>
          {labels[option]}
        </button>
      ))}
    </div>
  );
}

/**
 * The teammate finder board. Filters live in the URL, so a filtered view can
 * be shared in a Discord channel as a link.
 */
export function LfgBoard() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data: me } = useSession();
  const games = useGameOptions();

  const query = {
    gameId: params.get('game') ?? undefined,
    platform: (params.get('platform') as Platform | null) ?? undefined,
    language: (params.get('lang') as LfgLanguage | null) ?? undefined,
    mine: params.get('mine') === '1' ? 'true' : undefined,
    page: Number(params.get('page') ?? 1) || 1,
  };
  const posts = useQuery({ queryKey: SQUAD_KEYS.lfgList(query), queryFn: () => api.lfg.list(query), refetchInterval: 60_000 });

  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  };
  const hrefFor = (page: number) => {
    const next = new URLSearchParams(params);
    next.set('page', String(page));
    return `${pathname}?${next}`;
  };

  const mine = query.mine === 'true';
  return (
    <div className={styles.board}>
      <div className={styles.filters}>
        <div className={styles.filterRow}>
          <label className={styles.gameSelect}>
            <Icon name="gamepad" size={16} />
            <select value={query.gameId ?? ''} onChange={(event) => setParam('game', event.target.value || undefined)} aria-label={t.lfg.game}>
              <option value="">{t.lfg.allGames}</option>
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.title}
                </option>
              ))}
            </select>
          </label>
          {me ? (
            <button type="button" className={cx(styles.mineToggle, mine && styles.filterOn)} onClick={() => setParam('mine', mine ? undefined : '1')} aria-pressed={mine}>
              <Icon name="user" size={15} /> {t.lfg.myPosts}
            </button>
          ) : null}
        </div>
        {!mine ? (
          <div className={styles.filterRow}>
            <FilterChips label={t.lfg.platform} options={PLATFORMS} labels={t.labels.platform} value={query.platform} onChange={(value) => setParam('platform', value)} />
            <FilterChips label={t.lfg.voice} options={LFG_LANGUAGES} labels={t.labels.lfgLanguage} value={query.language} onChange={(value) => setParam('lang', value)} />
          </div>
        ) : null}
      </div>

      {posts.isPending ? (
        <div className={styles.grid}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} height={232} />
          ))}
        </div>
      ) : (posts.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          icon="users"
          title={mine ? t.lfg.noPostsMine : t.lfg.noPosts}
          action={<ButtonLink href="/squads/new" icon="plus">{t.squads.postSquad}</ButtonLink>}
        >
          {mine ? t.lfg.noPostsMineText : t.lfg.noPostsText}
        </EmptyState>
      ) : (
        <>
          <ul className={styles.grid}>
            {posts.data!.items.map((post) => (
              <li key={post.id}>
                <LfgCard post={post} />
              </li>
            ))}
          </ul>
          <Pagination page={posts.data!.page} totalPages={posts.data!.totalPages} hrefFor={hrefFor} />
        </>
      )}
    </div>
  );
}
