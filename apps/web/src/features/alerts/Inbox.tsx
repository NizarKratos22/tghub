'use client';

import { ALERT_CATEGORIES, ALERT_CATEGORY_META, type AlertCategory } from '@tgh/shared';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/primitives';
import { SESSION_KEY, SignedIn } from '@/features/auth/session';
import { api } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { ALERTS_KEY, NotificationRow, useOpenNotification } from './NotificationRow';
import styles from './Inbox.module.css';

type StatusFilter = 'all' | 'unread';

function InboxInner() {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState<AlertCategory | undefined>();
  const queryClient = useQueryClient();

  const inbox = useInfiniteQuery({
    queryKey: ['alerts', 'inbox', status, category],
    queryFn: ({ pageParam }) => api.alerts.inbox({ status, category, before: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const markAll = useMutation({
    mutationFn: () => api.alerts.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ALERTS_KEY });
      void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    },
  });
  const open = useOpenNotification();

  const items = inbox.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className={styles.inbox}>
      <div className={styles.toolbar}>
        <div className={styles.filters} role="group" aria-label="Filter alerts">
          {(['all', 'unread'] as const).map((value) => (
            <button key={value} type="button" className={cx(styles.filter, status === value && styles.filterOn)} onClick={() => setStatus(value)} aria-pressed={status === value}>
              {value === 'all' ? 'All' : 'Unread'}
            </button>
          ))}
          <span className={styles.divider} aria-hidden />
          {ALERT_CATEGORIES.map((value) => (
            <button
              key={value}
              type="button"
              className={cx(styles.filter, category === value && styles.filterOn)}
              onClick={() => setCategory(category === value ? undefined : value)}
              aria-pressed={category === value}
            >
              {ALERT_CATEGORY_META[value].label}
            </button>
          ))}
        </div>
        <div className={styles.actions}>
          <Button variant="outline" size="sm" icon="check" onClick={() => markAll.mutate()} loading={markAll.isPending}>
            Mark all read
          </Button>
          <ButtonLink href="/alerts/preferences" variant="ghost" size="sm" icon="settings">
            Preferences
          </ButtonLink>
        </div>
      </div>

      {inbox.isPending ? (
        <Skeleton height={320} />
      ) : items.length === 0 ? (
        <EmptyState icon="bell" title={status === 'unread' ? 'All caught up' : 'Nothing here yet'}>
          Favourite games to receive their patch notes, and pick categories in your preferences.
        </EmptyState>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => (
            <NotificationRow key={item.id} item={item} onOpen={open} />
          ))}
        </ul>
      )}

      {inbox.hasNextPage ? (
        <div className={styles.more}>
          <Button variant="outline" onClick={() => inbox.fetchNextPage()} loading={inbox.isFetchingNextPage}>
            Load older alerts
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function Inbox() {
  return (
    <SignedIn prompt="Sign in to see your alerts" promptText="Patch notes for the games you follow, deals before they expire, tournament reminders and your own level-ups — in one inbox.">
      {() => <InboxInner />}
    </SignedIn>
  );
}
