'use client';

import Link from 'next/link';
import { fill } from '@/i18n/config';
import { useT } from '@/i18n/I18nProvider';
import { cx } from '@/lib/cx';
import { Icon } from './Icon';
import styles from './primitives.module.css';

/** The words of <Pagination>, which itself stays usable from Server Components (it takes an `hrefFor` function). */
export function PaginationNav({ page, totalPages, prevHref, nextHref }: { page: number; totalPages: number; prevHref: string | null; nextHref: string | null }) {
  const t = useT();
  const words = t.common.pagination;
  return (
    <nav className={styles.pagination} aria-label={words.label}>
      {prevHref ? (
        <Link href={prevHref} className={styles.pageLink} rel="prev">
          <Icon name="chevronLeft" size={14} /> {words.prev}
        </Link>
      ) : (
        <span className={cx(styles.pageLink, styles.pageDisabled)}>
          <Icon name="chevronLeft" size={14} /> {words.prev}
        </span>
      )}
      <span className={styles.pageStatus}>{fill(words.status, { page, total: totalPages })}</span>
      {nextHref ? (
        <Link href={nextHref} className={styles.pageLink} rel="next">
          {words.next} <Icon name="chevronRight" size={14} />
        </Link>
      ) : (
        <span className={cx(styles.pageLink, styles.pageDisabled)}>
          {words.next} <Icon name="chevronRight" size={14} />
        </span>
      )}
    </nav>
  );
}
