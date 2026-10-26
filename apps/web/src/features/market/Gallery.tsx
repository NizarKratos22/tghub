'use client';

import type { MarketPhoto } from '@tgh/shared';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { fill } from '@/i18n/config';
import { useT } from '@/i18n/I18nProvider';
import { cx } from '@/lib/cx';
import styles from './Gallery.module.css';

/** Photo viewer: blurred backdrop of the current shot, arrows and keyboard, thumbnail strip. */
export function Gallery({ photos, title }: { photos: MarketPhoto[]; title: string }) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const photo = photos[index];
  const many = photos.length > 1;
  const go = (step: number) => setIndex((current) => (current + step + photos.length) % photos.length);

  if (!photo) {
    return (
      <div className={cx(styles.stage, styles.empty)}>
        <Icon name="image" size={40} />
        <span>{t.listing.noPhotos}</span>
      </div>
    );
  }

  return (
    <div className={styles.gallery}>
      <div
        className={styles.stage}
        tabIndex={many ? 0 : -1}
        aria-roledescription="carousel"
        aria-label={fill(t.listing.photos, { title })}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') go(-1);
          if (event.key === 'ArrowRight') go(1);
        }}
      >
        <span className={styles.backdrop} style={{ backgroundImage: `url(${photo.thumbUrl})` }} aria-hidden />
        <img
          key={photo.id}
          src={photo.url}
          alt={fill(t.listing.photoOf, { title, n: index + 1, total: photos.length })}
          width={photo.width}
          height={photo.height}
          className={styles.image}
        />
        {many ? (
          <>
            <button type="button" className={cx(styles.arrow, styles.prev)} onClick={() => go(-1)} aria-label={t.listing.previousPhoto}>
              <Icon name="chevronLeft" size={22} />
            </button>
            <button type="button" className={cx(styles.arrow, styles.next)} onClick={() => go(1)} aria-label={t.listing.nextPhoto}>
              <Icon name="chevronRight" size={22} />
            </button>
            <span className={styles.counter}>
              {index + 1} / {photos.length}
            </span>
          </>
        ) : null}
      </div>
      {many ? (
        <div className={styles.thumbs} role="tablist" aria-label={t.listing.choosePhoto}>
          {photos.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={fill(t.listing.photo, { n: i + 1 })}
              className={cx(styles.thumb, i === index && styles.thumbOn)}
              onClick={() => setIndex(i)}
            >
              <img src={item.thumbUrl} alt="" width={96} height={96} loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
