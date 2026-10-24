'use client';

import type { ConversationSummary, Me, RealtimeEvent } from '@tgh/shared';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { ALERTS_KEY, CATEGORY_ICONS } from '@/features/alerts/NotificationRow';
import { SESSION_KEY } from '@/features/auth/session';
import { LISTING_KEYS } from '@/features/market/meta';
import { cx } from '@/lib/cx';
import { useT } from '@/i18n/I18nProvider';
import { isExternal } from '@/lib/format';
import { useRealtimeEvent } from './RealtimeProvider';
import styles from './LiveUpdates.module.css';

const TOAST_MS = 7_000;
const MAX_TOASTS = 3;

interface Toast {
  id: string;
  title: string;
  body: string;
  href: string | null;
  kind: 'notification' | 'message';
  /** Notification category or chat partner. */
  icon?: (typeof CATEGORY_ICONS)[keyof typeof CATEGORY_ICONS];
  accent?: string;
  person?: { name: string; color: string; avatarUrl: string | null };
}

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const t = useT();
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const dismiss = () => {
    setLeaving(true);
    setTimeout(onClose, 180);
  };
  const arm = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(dismiss, TOAST_MS);
  };
  useEffect(() => {
    arm();
    return () => clearTimeout(timer.current);
    // Arm once on mount; hover pauses and re-arms.
  }, []);

  const content = (
    <>
      <span className={styles.badge}>
        {toast.person ? (
          <Avatar name={toast.person.name} color={toast.person.color} src={toast.person.avatarUrl} size={44} />
        ) : (
          <span className={cx(styles.iconBadge)} style={toast.accent ? ({ '--accent': toast.accent } as CSSProperties) : undefined}>
            <Icon name={toast.icon ?? 'bell'} size={20} />
          </span>
        )}
        <span className={cx(styles.corner, toast.kind === 'message' && styles.cornerMessage)} aria-hidden>
          <Icon name={toast.kind === 'message' ? 'message' : 'bell'} size={11} />
        </span>
      </span>
      <span className={styles.text}>
        <span className={styles.title}>{toast.title}</span>
        {toast.body ? <span className={styles.body}>{toast.body}</span> : null}
        <span className={styles.when}>{t.common.justNow}</span>
      </span>
    </>
  );

  return (
    <li className={cx(styles.toast, leaving && styles.leaving)} onMouseEnter={() => clearTimeout(timer.current)} onMouseLeave={arm}>
      {toast.href && !isExternal(toast.href) ? (
        <Link href={toast.href} className={styles.main} onClick={dismiss}>
          {content}
        </Link>
      ) : toast.href ? (
        <a href={toast.href} className={styles.main} target="_blank" rel="noopener noreferrer" onClick={dismiss}>
          {content}
        </a>
      ) : (
        <span className={styles.main}>{content}</span>
      )}
      <button type="button" className={styles.close} onClick={dismiss} aria-label={t.common.dismiss}>
        <Icon name="close" size={14} />
      </button>
    </li>
  );
}

/**
 * Applies live events to the cached data every screen reads (badge counts,
 * chat lists, "Seen") and pops a Facebook-style card in the corner for
 * anything new — unless the player is already looking at it.
 */
export function LiveUpdates() {
  const t = useT();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = (toast: Toast) => setToasts((current) => [toast, ...current.filter((t) => t.id !== toast.id)].slice(0, MAX_TOASTS));

  useRealtimeEvent((event: RealtimeEvent) => {
    switch (event.type) {
      case 'notification': {
        const { notification, unreadCount } = event.data;
        queryClient.setQueryData<Me | null>(SESSION_KEY, (me) => (me ? { ...me, unreadCount } : me));
        void queryClient.invalidateQueries({ queryKey: ALERTS_KEY });
        // XP and level live on the session; a level-up notification means they moved.
        void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
        // Chat starts arrive as notifications too; the chat card covers those.
        if (notification.url?.startsWith('/market/inbox/')) return;
        push({
          id: notification.id,
          kind: 'notification',
          title: notification.title,
          body: notification.summary,
          href: notification.url ?? '/alerts',
          icon: CATEGORY_ICONS[notification.category],
          accent: notification.game?.accent,
        });
        return;
      }
      case 'market.message': {
        const { conversationId, message, from, listingTitle } = event.data;
        void queryClient.invalidateQueries({ queryKey: ['market', 'conversations'] });
        if (message.mine) return;
        void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
        const href = `/market/inbox/${conversationId}`;
        if (pathname === href && document.visibilityState === 'visible') return;
        push({
          id: `chat-${conversationId}`,
          kind: 'message',
          title: from.displayName,
          body: `${listingTitle}: ${message.body}`,
          href,
          person: { name: from.displayName, color: from.avatarColor, avatarUrl: from.avatarUrl },
        });
        return;
      }
      case 'market.read': {
        const { conversationId, readAt } = event.data;
        queryClient.setQueryData<ConversationSummary>(LISTING_KEYS.conversation(conversationId), (conversation) =>
          conversation ? { ...conversation, counterpartReadAt: readAt } : conversation,
        );
        return;
      }
      default:
        return;
    }
  });

  if (toasts.length === 0) return null;
  return (
    <ol className={styles.stack} aria-live="polite" aria-label={t.live.newActivity}>
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onClose={() => setToasts((current) => current.filter((t) => t.id !== toast.id))} />
      ))}
    </ol>
  );
}
