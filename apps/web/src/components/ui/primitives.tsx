import Link from 'next/link';
import type { CheckStatus } from '@tgh/shared';
import type { CSSProperties, ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './Icon';
import styles from './primitives.module.css';

/* ── Panel: the basic card surface. "inverse" flips to the opposite theme. ── */

export function Panel({
  children,
  tone = 'card',
  className,
  as: Tag = 'section',
}: {
  children: ReactNode;
  tone?: 'card' | 'inverse' | 'flat';
  className?: string;
  as?: 'section' | 'div' | 'article' | 'aside';
}) {
  return <Tag className={cx(styles.panel, styles[`panel_${tone}`], className)}>{children}</Tag>;
}

/* ── Tag: small pill label. ── */

export type TagTone = 'line' | 'brand' | 'primary' | 'success' | 'danger' | 'gold' | 'purple' | 'solid' | 'muted';

export function Tag({ children, tone = 'line', className }: { children: ReactNode; tone?: TagTone; className?: string }) {
  return <span className={cx(styles.tag, styles[`tag_${tone}`], className)}>{children}</span>;
}

/* ── Avatar: the player's picture, or a monogram disc in their colour. ── */

function isLight(hex: string): boolean {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

export function Avatar({ name, color, src, size = 40 }: { name: string; color: string; src?: string | null; size?: number }) {
  if (src) {
    return (
      <span className={cx(styles.avatar, styles.avatarPhoto)} style={{ width: size, height: size, background: color }} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element -- immutable media URL, already sized by the API */}
        <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" />
      </span>
    );
  }
  const initials = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
  return (
    <span
      className={styles.avatar}
      style={{ width: size, height: size, fontSize: size * 0.42, background: color, color: isLight(color) ? '#1f2123' : '#ffffff' }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/* ── Meter: rounded progress bar with optional segment notches and milestone ticks. ── */

export function Meter({
  value,
  segments = 0,
  ticks = [],
  tone = 'primary',
  label,
  height = 12,
}: {
  /** 0..1 */
  value: number;
  /** Notches drawn over the bar; 0 = a plain bar. */
  segments?: number;
  ticks?: number[];
  tone?: 'primary' | 'gold' | 'success';
  label: string;
  height?: number;
}) {
  const percent = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={cx(styles.meter, styles[`meter_${tone}`], segments > 0 && styles.meterNotched)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      style={{ '--segments': segments, height } as CSSProperties}
    >
      <span className={styles.meterFill} style={{ width: `${percent}%` }} />
      {ticks.map((tick) => (
        <span key={tick} className={styles.meterTick} style={{ left: `${tick * 100}%` }} />
      ))}
    </div>
  );
}

/* ── StatusBadge: compatibility verdicts. ── */

const STATUS_LABEL: Record<CheckStatus, string> = {
  recommended: 'Recommended',
  minimum: 'Minimum',
  below: 'Below minimum',
  unknown: 'No data',
};

export function StatusBadge({ status, size = 'md' }: { status: CheckStatus; size?: 'sm' | 'md' }) {
  return <span className={cx(styles.status, styles[`status_${status}`], size === 'sm' && styles.statusSm)}>{STATUS_LABEL[status]}</span>;
}

/* ── EmptyState ── */

export function EmptyState({
  icon = 'radar',
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>
        <Icon name={icon} size={22} />
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      {children ? <div className={styles.emptyText}>{children}</div> : null}
      {action ? <div className={styles.emptyAction}>{action}</div> : null}
    </div>
  );
}

/* ── Skeleton ── */

export function Skeleton({ height = 16, width = '100%', className }: { height?: number | string; width?: number | string; className?: string }) {
  return <span className={cx(styles.skeleton, className)} style={{ height, width }} aria-hidden />;
}

/* ── Segmented navigation (links) — works in Server Components. ── */

export interface SegmentItem {
  href: string;
  label: string;
  active: boolean;
  count?: number;
}

export function SegmentedNav({ items, label }: { items: SegmentItem[]; label: string }) {
  return (
    <nav aria-label={label} className={styles.segments}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cx(styles.segment, item.active && styles.segmentActive)}
          aria-current={item.active ? 'page' : undefined}
          scroll={false}
        >
          {item.label}
          {item.count !== undefined ? <span className={styles.segmentCount}>{item.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

/* ── Pagination ── */

export function Pagination({ page, totalPages, hrefFor }: { page: number; totalPages: number; hrefFor: (page: number) => string }) {
  if (totalPages <= 1) return null;
  return (
    <nav className={styles.pagination} aria-label="Pagination">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={styles.pageLink} rel="prev">
          <Icon name="chevronLeft" size={14} /> Prev
        </Link>
      ) : (
        <span className={cx(styles.pageLink, styles.pageDisabled)}>
          <Icon name="chevronLeft" size={14} /> Prev
        </span>
      )}
      <span className={styles.pageStatus}>
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className={styles.pageLink} rel="next">
          Next <Icon name="chevronRight" size={14} />
        </Link>
      ) : (
        <span className={cx(styles.pageLink, styles.pageDisabled)}>
          Next <Icon name="chevronRight" size={14} />
        </span>
      )}
    </nav>
  );
}
