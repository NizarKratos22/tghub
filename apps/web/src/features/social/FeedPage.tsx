'use client';

import type { PlayerCard } from '@tgh/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, Skeleton } from '@/components/ui/primitives';
import { SignedIn } from '@/features/auth/session';
import { api } from '@/lib/api/client';
import { ActivityList, FeedEmpty, PlayerRow, SOCIAL_KEYS, WhoToFollow } from './social';
import styles from './FeedPage.module.css';

export function FeedPage() {
  return (
    <SignedIn prompt="Sign in to see your feed" promptText="Follow players to see their level-ups, listings and clan moves.">
      {(me) => (
        <div className={styles.layout}>
          <div className={styles.main}>
            {!me.shareActivity ? (
              <p className={styles.notice}>
                <Icon name="eye" size={16} /> Your activity is private — followers don&rsquo;t see it. <Link href="/settings">Change in settings</Link>
              </p>
            ) : null}
            <ActivityList queryKey={SOCIAL_KEYS.feed} load={(before) => api.social.feed(before)} empty={<FeedEmpty />} />
          </div>
          <aside className={styles.side}>
            <WhoToFollow />
            <section className={styles.links}>
              <Link href="/squads">
                <Icon name="users" size={18} /> Find teammates
              </Link>
              <Link href="/clans">
                <Icon name="shield" size={18} /> Clan standings
              </Link>
              <Link href={`/u/${me.username}`}>
                <Icon name="user" size={18} /> Your profile
              </Link>
            </section>
          </aside>
        </div>
      )}
    </SignedIn>
  );
}

/** Followers or following of one player. */
export function FollowList({ username, direction }: { username: string; direction: 'followers' | 'following' }) {
  const pages = useInfiniteQuery({
    queryKey: SOCIAL_KEYS.list(username, direction),
    queryFn: ({ pageParam }) => (direction === 'followers' ? api.social.followers(username, pageParam) : api.social.following(username, pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  if (pages.isPending) return <Skeleton height={240} />;
  const players: PlayerCard[] = pages.data?.pages.flatMap((page) => page.items) ?? [];
  if (players.length === 0) {
    return <EmptyState icon="users" title={direction === 'followers' ? 'No followers yet' : 'Not following anyone yet'} />;
  }
  return (
    <div className={styles.listWrap}>
      <ul className={styles.list}>
        {players.map((player) => (
          <PlayerRow key={player.id} player={player} />
        ))}
      </ul>
      {pages.hasNextPage ? (
        <Button variant="ghost" block onClick={() => pages.fetchNextPage()} loading={pages.isFetchingNextPage}>
          Show more
        </Button>
      ) : null}
    </div>
  );
}
