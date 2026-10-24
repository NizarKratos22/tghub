'use client';

import type { SellerReputation } from '@tgh/shared';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/lib/cx';
import styles from './reputation.module.css';

/** Read-only stars; halves round to the nearest half star. */
export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className={cx(styles.stars, className)} role="img" aria-label={`${value} out of 5 stars`} style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={cx(styles.star, rounded >= n ? styles.full : rounded >= n - 0.5 ? styles.half : null)} aria-hidden>
          ★
        </span>
      ))}
    </span>
  );
}

const STAR_WORDS = ['Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];

export function StarPicker({ value, onChange }: { value: number; onChange: (stars: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className={styles.picker}>
      <div className={styles.pickerStars} role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n === 1 ? '' : 's'} — ${STAR_WORDS[n - 1]}`}
            className={cx(styles.pick, shown >= n && styles.pickOn)}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
          >
            ★
          </button>
        ))}
      </div>
      <span className={styles.pickerWord}>{shown ? STAR_WORDS[shown - 1] : 'Tap a star'}</span>
    </div>
  );
}

export function VerifiedSeller({ compact = false }: { compact?: boolean }) {
  return (
    <span className={cx(styles.verified, compact && styles.verifiedCompact)} title="Verified seller: confirmed sales, strong ratings, clean record">
      <Icon name="check" size={compact ? 11 : 12} /> {compact ? 'Verified' : 'Verified seller'}
    </span>
  );
}

/** "★★★★★ 4.8 · 12 ratings · 9 sales" with the badge when earned. */
export function ReputationLine({ reputation }: { reputation: SellerReputation }) {
  return (
    <span className={styles.line}>
      {reputation.average !== null ? (
        <>
          <Stars value={reputation.average} />
          <strong>{reputation.average.toFixed(1)}</strong>
          <span>
            · {reputation.count} rating{reputation.count === 1 ? '' : 's'}
          </span>
        </>
      ) : (
        <span>No ratings yet</span>
      )}
      {reputation.sales > 0 ? (
        <span>
          · {reputation.sales} sale{reputation.sales === 1 ? '' : 's'} on TG Hub
        </span>
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
