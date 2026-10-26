'use client';

import type { Activity, ActivityType, CursorPage, FollowStatus, PlayerCard } from '@tgh/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Avatar, EmptyState, Skeleton } from '@/components/ui/primitives';
import { RelativeTime } from '@/components/ui/time';
import { useSession, useSignInHref } from '@/features/auth/session';
import { Flag } from '@/features/squads/shared';
import { api } from '@/lib/api/client';
import { fill } from '@/i18n/config';
import { useFormat, useT } from '@/i18n/I18nProvider';
import { cx } from '@/lib/cx';
import styles from './social.module.css';

export const SOCIAL_KEYS = {
  feed: ['social', 'feed'] as const,
  activity: (username: string) => ['social', 'activity', username] as const,
  status: (username: string) => ['social', 'status', username] as const,
  suggestions: ['social', 'suggestions'] as const,
  list: (username: string, direction: string) => ['social', 'list', username, direction] as const,
};

const TYPE_ICONS: Record<ActivityType, IconName> = {
  level_up: 'bolt',
  achievement: 'trophy',
  listing: 'tag',
  clan_founded: 'shield',
  clan_joined: 'shield',
  lfg_posted: 'users',
  game_favorited: 'heart',
};

/* ───────────── Follow ───────────── */

export function FollowButton({ username, size = 'md', onChange }: { username: string; size?: 'sm' | 'md'; onChange?: (status: FollowStatus) => void }) {
  const t = useT();
  const { data: me } = useSession();
  const signInHref = useSignInHref();
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: SOCIAL_KEYS.status(username), queryFn: () => api.social.status(username), enabled: Boolean(me) && me?.username !== username });
  const toggle = useMutation({
    mutationFn: () => (status.data?.following ? api.social.unfollow(username) : api.social.follow(username)),
    onSuccess: (next) => {
      queryClient.setQueryData(SOCIAL_KEYS.status(username), next);
      void queryClient.invalidateQueries({ queryKey: SOCIAL_KEYS.feed });
      void queryClient.invalidateQueries({ queryKey: SOCIAL_KEYS.suggestions });
      onChange?.(next);
    },
  });

  if (me?.username === username) return null;
  if (!me) {
    return (
      <Link href={signInHref} className={cx(styles.follow, size === 'sm' && styles.followSm)}>
        <Icon name="plus" size={14} /> {t.feed.follow}
      </Link>
    );
  }
  const following = status.data?.following ?? false;
  return (
    <button
      type="button"
      className={cx(styles.follow, following && styles.following, size === 'sm' && styles.followSm)}
      onClick={() => toggle.mutate()}
      disabled={status.isPending || toggle.isPending}
      aria-pressed={following}
    >
      {following ? (
        <>
          <Icon name="check" size={14} />
          <span className={styles.followingLabel}>{t.feed.following}</span>
          <span className={styles.unfollowLabel}>{t.feed.unfollow}</span>
        </>
      ) : (
        <>
          <Icon name="plus" size={14} /> {status.data?.followsYou ? t.feed.followBack : t.feed.follow}
        </>
      )}
    </button>
  );
}

/* ───────────── Activity ───────────── */

function ActivityVisual({ activity }: { activity: Activity }) {
  const visual = activity.visual;
  if (visual?.kind === 'image') {
    return <img src={visual.url} alt="" className={styles.thumb} width={56} height={56} loading="lazy" />;
  }
  if (visual?.kind === 'mark') {
    return (
      <span className={cx(styles.mark, activity.type === 'level_up' && styles.markLevel)} style={{ '--mark': visual.color } as CSSProperties}>
        {visual.label}
      </span>
    );
  }
  return (
    <span className={cx(styles.mark, styles.markIcon)}>
      <Icon name={TYPE_ICONS[activity.type]} size={22} />
    </span>
  );
}

export function ActivityItem({ activity, onGg }: { activity: Activity; onGg?: (update: { gg: number; ggByYou: boolean }) => void }) {
  const t = useT();
  const format = useFormat();
  const { data: me } = useSession();
  // Worded per language from the type; the stored English sentence covers a row with no number to fill in.
  const template = t.social.activity[activity.type];
  const sentence = activity.value === null && template.includes('{value') ? activity.text : format.fill(template, { value: activity.value ?? 0 });
  const detail = activity.type === 'listing' && activity.value !== null ? format.tnd(activity.value) : activity.detail;
  const gg = useMutation({ mutationFn: () => api.social.gg(activity.id), onSuccess: onGg });
  const own = me?.id === activity.actor.id;
  return (
    <li className={styles.item}>
      <Link href={`/u/${activity.actor.username}`} className={styles.itemAvatar} aria-label={activity.actor.displayName}>
        <Avatar name={activity.actor.displayName} color={activity.actor.avatarColor} src={activity.actor.avatarUrl} size={42} />
        <span className={cx(styles.typeBadge, styles[`type_${activity.type}`])} aria-hidden>
          <Icon name={TYPE_ICONS[activity.type]} size={11} />
        </span>
      </Link>
      <div className={styles.itemBody}>
        <p className={styles.sentence}>
          <Link href={`/u/${activity.actor.username}`} className={styles.actor}>
            {activity.actor.displayName}
          </Link>{' '}
          {sentence}{' '}
          {activity.target ? (
            <Link href={activity.target.href} className={styles.target}>
              {activity.target.label}
            </Link>
          ) : null}
        </p>
        {detail ? <p className={styles.detail}>{detail}</p> : null}
        <div className={styles.itemMeta}>
          <RelativeTime iso={activity.createdAt} />
          <span aria-hidden>·</span>
          <span>{fill(t.common.levelShort, { level: activity.actor.level })}</span>
          <Flag country={activity.actor.country} />
          {me && !own ? (
            <button type="button" className={cx(styles.gg, activity.ggByYou && styles.ggOn)} onClick={() => gg.mutate()} disabled={gg.isPending} aria-pressed={activity.ggByYou}>
              GG{activity.gg > 0 ? <span>{activity.gg}</span> : null}
            </button>
          ) : activity.gg > 0 ? (
            <span className={styles.ggCount}>{activity.gg} GG</span>
          ) : null}
        </div>
      </div>
      <ActivityVisual activity={activity} />
    </li>
  );
}

/** Paged activity list shared by the feed and profiles; "GG" updates the cached page in place. */
export function ActivityList({ queryKey, load, empty }: { queryKey: readonly unknown[]; load: (before?: string) => Promise<CursorPage<Activity>>; empty: ReactNode }) {
  const t = useT();
  const queryClient = useQueryClient();
  const pages = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => load(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const patch = (id: string, update: { gg: number; ggByYou: boolean }) =>
    queryClient.setQueryData<InfiniteData<CursorPage<Activity>>>(queryKey, (data) =>
      data ? { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.map((item) => (item.id === id ? { ...item, ...update } : item)) })) } : data,
    );

  if (pages.isPending) {
    return (
      <div className={styles.loading}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={74} />
        ))}
      </div>
    );
  }
  const items = pages.data?.pages.flatMap((page) => page.items) ?? [];
  if (items.length === 0) return <>{empty}</>;
  return (
    <>
      <ul className={styles.list}>
        {items.map((activity) => (
          <ActivityItem key={activity.id} activity={activity} onGg={(update) => patch(activity.id, update)} />
        ))}
      </ul>
      {pages.hasNextPage ? (
        <Button variant="ghost" block onClick={() => pages.fetchNextPage()} loading={pages.isFetchingNextPage}>
          {t.feed.olderShow}
        </Button>
      ) : null}
    </>
  );
}

/* ───────────── People ───────────── */

export function PlayerRow({ player, action }: { player: PlayerCard; action?: ReactNode }) {
  const t = useT();
  return (
    <li className={styles.player}>
      <Link href={`/u/${player.username}`} className={styles.playerLink}>
        <Avatar name={player.displayName} color={player.avatarColor} src={player.avatarUrl} size={38} />
        <span className={styles.playerText}>
          <strong>{player.displayName}</strong>
          <span>
            {fill(t.common.levelShort, { level: player.level })} <Flag country={player.country} />
          </span>
        </span>
      </Link>
      {action ?? <FollowButton username={player.username} size="sm" />}
    </li>
  );
}

export function WhoToFollow() {
  const t = useT();
  const suggestions = useQuery({ queryKey: SOCIAL_KEYS.suggestions, queryFn: api.social.suggestions });
  if (suggestions.isPending) return <Skeleton height={220} />;
  const players = suggestions.data ?? [];
  if (players.length === 0) return null;
  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{t.feed.playersToFollow}</h2>
      <ul className={styles.people}>
        {players.map((player) => (
          <PlayerRow key={player.id} player={player} />
        ))}
      </ul>
    </section>
  );
}

export function FeedEmpty() {
  const t = useT();
  return (
    <EmptyState icon="users" title={t.feed.quiet}>
      {t.feed.quietText}
    </EmptyState>
  );
}
