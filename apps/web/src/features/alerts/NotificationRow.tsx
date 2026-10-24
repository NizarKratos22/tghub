'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';
import { ALERT_CATEGORY_META, type AlertCategory, type Notification } from '@tgh/shared';
import { Icon, type IconName } from '@/components/ui/Icon';
import { RelativeTime } from '@/components/ui/time';
import { SESSION_KEY } from '@/features/auth/session';
import { api } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { isExternal } from '@/lib/format';
import styles from './NotificationRow.module.css';

export const CATEGORY_ICONS: Record<AlertCategory, IconName> = {
  game_update: 'refresh',
  deal: 'tag',
  tournament: 'trophy',
  social: 'star',
  announcement: 'bell',
};

export const ALERTS_KEY = ['alerts'] as const;

/** Mark as read, then follow the link — the same behaviour in the dropdown and on the page. */
export function useOpenNotification(onOpened?: () => void) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const markRead = useMutation({
    mutationFn: (id: string) => api.alerts.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ALERTS_KEY });
      void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    },
  });
  return (item: Notification) => {
    if (!item.readAt) markRead.mutate(item.id);
    onOpened?.();
    if (!item.url) return;
    if (isExternal(item.url)) window.open(item.url, '_blank', 'noopener,noreferrer');
    else router.push(item.url);
  };
}

/** Facebook-style row: a round badge for the game or category, the text, an unread dot. */
export function NotificationRow({ item, onOpen, compact = false }: { item: Notification; onOpen: (item: Notification) => void; compact?: boolean }) {
  const unread = !item.readAt;
  return (
    <li>
      <button type="button" className={cx(styles.row, unread && styles.unread, compact && styles.compact)} onClick={() => onOpen(item)}>
        <span className={styles.badgeWrap}>
          {item.game ? (
            <span className={styles.gameBadge} style={{ '--accent': item.game.accent } as CSSProperties}>
              {item.game.monogram}
            </span>
          ) : (
            <span className={cx(styles.iconBadge, styles[`cat_${item.category}`])}>
              <Icon name={CATEGORY_ICONS[item.category]} size={compact ? 20 : 22} />
            </span>
          )}
          <span className={cx(styles.corner, styles[`cat_${item.category}`])} aria-hidden>
            <Icon name={CATEGORY_ICONS[item.category]} size={11} />
          </span>
        </span>
        <span className={styles.body}>
          <span className={styles.title}>{item.title}</span>
          {item.summary ? <span className={styles.summary}>{item.summary}</span> : null}
          <span className={styles.meta}>
            <RelativeTime iso={item.createdAt} className={styles.time} />
            <span className={styles.dotSep} aria-hidden>
              ·
            </span>
            <span>{ALERT_CATEGORY_META[item.category].label}</span>
            {item.url && isExternal(item.url) ? <Icon name="arrowUpRight" size={12} /> : null}
          </span>
        </span>
        {unread ? <span className={styles.unreadDot} aria-label="Unread" /> : null}
      </button>
    </li>
  );
}
