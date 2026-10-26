'use client';

import type { SellerReputation } from '@tgh/shared';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { fill } from '@/i18n/config';
import { useFormat, useT } from '@/i18n/I18nProvider';
import { cx } from '@/lib/cx';
import styles from './reputation.module.css';

/** Read-only stars; halves round to the nearest half star. */
export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  const t = useT();
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className={cx(styles.stars, className)} role="img" aria-label={fill(t.reputation.outOf5, { value })} style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={cx(styles.star, rounded >= n ? styles.full : rounded >= n - 0.5 ? styles.half : null)} aria-hidden>
          ★
        </span>
      ))}
    </span>
  );
}

export function StarPicker({ value, onChange }: { value: number; onChange: (stars: number) => void }) {
  const t = useT();
  const format = useFormat();
  const words = t.reputation.words;
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className={styles.picker}>
      <div className={styles.pickerStars} role="radiogroup" aria-label={t.reputation.rating} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={format.fill(t.reputation.starOption, { n, word: words[n - 1]! })}
            className={cx(styles.pick, shown >= n && styles.pickOn)}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
          >
            ★
          </button>
        ))}
      </div>
      <span className={styles.pickerWord}>{shown ? words[shown - 1] : t.reputation.tapStar}</span>
    </div>
  );
}

export function VerifiedSeller({ compact = false }: { compact?: boolean }) {
  const t = useT();
  return (
    <span className={cx(styles.verified, compact && styles.verifiedCompact)} title={t.reputation.verifiedTitle}>
      <Icon name="check" size={compact ? 11 : 12} /> {compact ? t.reputation.verified : t.reputation.verifiedSeller}
    </span>
  );
}

/** "★★★★★ 4.8 · 12 ratings · 9 sales" with the badge when earned. */
export function ReputationLine({ reputation }: { reputation: SellerReputation }) {
  const t = useT();
  const format = useFormat();
  return (
    <span className={styles.line}>
      {reputation.average !== null ? (
        <>
          <Stars value={reputation.average} />
          <strong>{reputation.average.toFixed(1)}</strong>
          <span>· {format.fill(t.reputation.ratings, { count: reputation.count })}</span>
        </>
      ) : (
        <span>{t.reputation.noRatings}</span>
      )}
      {reputation.sales > 0 ? (
        <span>· {format.fill(t.reputation.salesOnHub, { count: reputation.sales })}</span>
      ) : null}
      {reputation.verified ? <VerifiedSeller compact /> : null}
    </span>
  );
}

/** Five bars, 5 stars on top, like every store rating summary. */
export function RatingBars({ reputation }: { reputation: SellerReputation }) {
  const max = Math.max(1, ...reputation.distribution);
  return (
    <div className={styles.bars}>
      {[5, 4, 3, 2, 1].map((stars) => {
        const n = reputation.distribution[stars - 1]!;
        return (
          <div key={stars} className={styles.bar}>
            <span>{stars}★</span>
            <span className={styles.barTrack}>
              <span className={styles.barFill} style={{ width: `${(n / max) * 100}%` }} />
            </span>
            <span className={styles.barCount}>{n}</span>
          </div>
        );
      })}
    </div>
  );
}
