'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Avatar, Skeleton } from '@/components/ui/primitives';
import { api, ApiError } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { LISTING_KEYS } from './meta';
import styles from './SoldDialog.module.css';

const OUTSIDE = 'outside';

/**
 * "Who bought it?" — picking the buyer from the chats lets them rate the sale,
 * which is what builds a seller's reputation and verified badge.
 */
export function SoldDialog({ listingId, title, onClose, onDone }: { listingId: string; title: string; onClose: () => void; onDone: () => void }) {
  const viewer = useQuery({ queryKey: LISTING_KEYS.viewer(listingId), queryFn: () => api.market.viewer(listingId) });
  const [choice, setChoice] = useState<string | null>(null);
  const buyers = viewer.data?.buyers ?? [];
  const sell = useMutation({
    mutationFn: () => api.market.setStatus(listingId, 'sold', choice === OUTSIDE ? null : choice),
    onSuccess: onDone,
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !sell.isPending && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, sell.isPending]);

  // Nobody messaged: nothing to choose.
  const selected = choice ?? (viewer.data && buyers.length === 0 ? OUTSIDE : null);

  return (
    <div className={styles.overlay} onClick={sell.isPending ? undefined : onClose}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="sold-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="sold-title" className={styles.title}>
          Who bought it?
        </h2>
        <p className={styles.text}>
          &ldquo;{title}&rdquo; — the buyer you pick gets to rate you. Ratings build your verified seller badge.
        </p>
        {viewer.isPending ? (
          <Skeleton height={120} />
        ) : (
          <div className={styles.options} role="radiogroup" aria-label="Buyer">
            {buyers.map((buyer) => (
              <button key={buyer.id} type="button" role="radio" aria-checked={selected === buyer.id} className={cx(styles.option, selected === buyer.id && styles.optionOn)} onClick={() => setChoice(buyer.id)}>
                <Avatar name={buyer.displayName} color={buyer.avatarColor} src={buyer.avatarUrl} size={34} />
                <span>{buyer.displayName}</span>
                {selected === buyer.id ? <Icon name="check" size={16} /> : null}
              </button>
            ))}
            <button type="button" role="radio" aria-checked={selected === OUTSIDE} className={cx(styles.option, selected === OUTSIDE && styles.optionOn)} onClick={() => setChoice(OUTSIDE)}>
              <span className={styles.outsideIcon}>
                <Icon name="user" size={16} />
              </span>
              <span>Someone outside TG Hub</span>
              {selected === OUTSIDE ? <Icon name="check" size={16} /> : null}
            </button>
          </div>
        )}
        <FormError message={sell.error instanceof ApiError ? sell.error.message : null} />
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose} disabled={sell.isPending}>
            Cancel
          </Button>
          <Button icon="check" onClick={() => sell.mutate()} loading={sell.isPending} disabled={!selected}>
            Mark as sold
          </Button>
        </div>
      </div>
    </div>
  );
}
