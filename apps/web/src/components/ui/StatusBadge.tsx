'use client';

import type { CheckStatus } from '@tgh/shared';
import { useT } from '@/i18n/I18nProvider';
import { cx } from '@/lib/cx';
import styles from './primitives.module.css';

/** Compatibility verdict pill: recommended, minimum, below, no data. */
export function StatusBadge({ status, size = 'md' }: { status: CheckStatus; size?: 'sm' | 'md' }) {
  const t = useT();
  return <span className={cx(styles.status, styles[`status_${status}`], size === 'sm' && styles.statusSm)}>{t.pc.status[status]}</span>;
}
