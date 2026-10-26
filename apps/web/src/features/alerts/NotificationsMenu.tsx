'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Notification } from '@tgh/shared';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/ui/primitives';
import { SESSION_KEY } from '@/features/auth/session';
import { PushPrompt } from '@/features/realtime/PushControls';
import { api } from '@/lib/api/client';
import { fill } from '@/i18n/config';
import { useT } from '@/i18n/I18nProvider';
import { cx } from '@/lib/cx';
import { useOpenForRoute } from '@/lib/useOpenForRoute';
import { ALERTS_KEY, NotificationRow, useOpenNotification } from './NotificationRow';
import styles from './NotificationsMenu.module.css';

type Tab = 'all' | 'unread';
const DAY_MS = 86_400_000;

/** "New" = the last 24 hours, "Earlier" = everything before — the way Facebook splits its list. */
function groups(items: Notification[], labels: { fresh: string; earlier: string }) {
  const cutoff = Date.now() - DAY_MS;
  const fresh = items.filter((item) => new Date(item.createdAt).getTime() >= cutoff);
  const earlier = items.filter((item) => new Date(item.createdAt).getTime() < cutoff);
  return [
    { title: labels.fresh, items: fresh },
    { title: labels.earlier, items: earlier },
  ].filter((group) => group.items.length > 0);
}

function Panel({ onClose, top }: { onClose: () => void; top: number }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>('all');
  const queryClient = useQueryClient();
  const list = useQuery({
    queryKey: [...ALERTS_KEY, 'menu', tab],
    queryFn: () => api.alerts.inbox({ status: tab, limit: 15 }),
    refetchInterval: 60_000,
  });
  const markAll = useMutation({
    mutationFn: () => api.alerts.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ALERTS_KEY });
      void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    },
  });
  const open = useOpenNotification(onClose);
  const items = list.data?.items ?? [];

  return (
    <div className={styles.panel} role="dialog" aria-label={t.notifications.title} style={{ '--menu-top': `${top}px` } as CSSProperties}>
      <div className={styles.head}>
        <h2>{t.notifications.title}</h2>
        <Link href="/alerts/preferences" className={styles.headIcon} aria-label={t.notifications.settings} title={t.notifications.settings} onClick={onClose}>
          <Icon name="settings" size={18} />
        </Link>
      </div>
      <div className={styles.bar}>
        <div className={styles.tabs} role="tablist" aria-label={t.notifications.show}>
          {(['all', 'unread'] as const).map((value) => (
            <button key={value} type="button" role="tab" aria-selected={tab === value} className={cx(styles.tab, tab === value && styles.tabOn)} onClick={() => setTab(value)}>
              {value === 'all' ? t.common.all : t.notifications.unread}
            </button>
          ))}
        </div>
        <button type="button" className={styles.markAll} onClick={() => markAll.mutate()} disabled={markAll.isPending}>
          {t.notifications.markAll}
        </button>
      </div>

      <div className={styles.scroll}>
        <PushPrompt />
        {list.isPending ? (
          <div className={styles.loading}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={60} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>
              <Icon name="bell" size={24} />
            </span>
            <p>{tab === 'unread' ? t.notifications.caughtUp : t.notifications.none}</p>
            <span>{t.notifications.emptyText}</span>
          </div>
        ) : (
          groups(items, t.notifications).map((group) => (
            <section key={group.title}>
              <p className={styles.groupTitle}>{group.title}</p>
              <ul>
                {group.items.map((item) => (
                  <NotificationRow key={item.id} item={item} onOpen={open} compact />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <Link href="/alerts" className={styles.seeAll} onClick={onClose}>
        {t.notifications.seeAll}
      </Link>
    </div>
  );
}

/** The header bell: a red unread count and a dropdown panel instead of a page jump. */
export function NotificationsMenu({ unread, className, activeClassName, badgeClassName }: { unread: number; className?: string; activeClassName?: string; badgeClassName?: string }) {
  const t = useT();
  const [open, setOpen] = useOpenForRoute();
  // On phones the panel is a fixed sheet under the header, which sits lower while the ticker shows.
  const [top, setTop] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open, setOpen]);

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={cx(className, open && activeClassName)}
        aria-label={fill(t.notifications.bell, { count: unread })}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          setTop(ref.current?.closest('header')?.getBoundingClientRect().bottom ?? 0);
          setOpen((value) => !value);
        }}
      >
        <Icon name="bell" size={19} filled={open} />
        {unread > 0 ? <span className={badgeClassName}>{unread > 99 ? '99+' : unread}</span> : null}
      </button>
      {open ? <Panel onClose={() => setOpen(false)} top={top} /> : null}
    </div>
  );
}
