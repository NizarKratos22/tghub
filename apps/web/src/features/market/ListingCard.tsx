'use client';

import Link from 'next/link';
import type { ListingCard as ListingCardData } from '@tgh/shared';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/i18n/I18nProvider';
import { cx } from '@/lib/cx';
import { formatTnd } from '@/lib/format';
import { CATEGORY_ICONS, listingSubline } from './meta';
import styles from './ListingCard.module.css';

/** Marketplace tile: square photo, price first, then title and where it is. */
export function ListingCard({ listing, priority = false }: { listing: ListingCardData; priority?: boolean }) {
  const t = useT();
  const closed = listing.status === 'sold' || listing.status === 'pending';
  return (
    <Link href={`/market/item/${listing.id}`} className={styles.card}>
      <span className={styles.photo}>
        {listing.photo ? (
          // Thumbnails are pre-cropped 480px squares from the API; plain <img> keeps them cacheable and simple.
          <img src={listing.photo.thumbUrl} alt="" width={480} height={480} loading={priority ? 'eager' : 'lazy'} decoding="async" />
        ) : (
          <span className={styles.noPhoto}>
            <Icon name={CATEGORY_ICONS[listing.category]} size={36} />
          </span>
        )}
        {listing.digital ? (
          <span className={styles.badge}>
            <Icon name="download" size={12} /> {t.market.digital}
          </span>
        ) : listing.shipping ? (
          <span className={styles.badge}>
            <Icon name="box" size={12} /> {t.market.delivery}
          </span>
        ) : null}
        {closed ? <span className={cx(styles.state, listing.status === 'sold' && styles.sold)}>{listing.status === 'sold' ? t.market.sold : t.market.pending}</span> : null}
        {listing.featured && !closed ? (
          <span className={styles.featured}>
            <Icon name="bolt" size={11} /> {t.market.featured}
          </span>
        ) : null}
      </span>
      <span className={styles.body}>
        <span className={cx(styles.price, listing.price === 0 && styles.free)}>{formatTnd(listing.price)}</span>
        <span className={styles.title}>{listing.title}</span>
        <span className={styles.sub}>{listingSubline(listing)}</span>
      </span>
    </Link>
  );
}

export function ListingGrid({ listings, dense = false }: { listings: ListingCardData[]; dense?: boolean }) {
  return (
    <ul className={cx(styles.grid, dense && styles.dense)}>
      {listings.map((listing, index) => (
        <li key={listing.id}>
          <ListingCard listing={listing} priority={index < 4} />
        </li>
      ))}
    </ul>
  );
}
