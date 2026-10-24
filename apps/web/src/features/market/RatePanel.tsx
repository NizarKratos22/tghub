'use client';

import type { ListingDetail, ListingViewerState } from '@tgh/shared';
import { RATING_EDIT_DAYS } from '@tgh/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/Field';
import { api, ApiError } from '@/lib/api/client';
import { LISTING_KEYS } from './meta';
import { StarPicker, Stars } from './reputation';
import styles from './RatePanel.module.css';

/** For the buyer the seller picked: rate the sale, and adjust it for a couple of weeks. */
export function RatePanel({ listing, state }: { listing: ListingDetail; state: ListingViewerState }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(!state.myRating);
  const [stars, setStars] = useState(state.myRating?.stars ?? 0);
  const [comment, setComment] = useState(state.myRating?.comment ?? '');
  const save = useMutation({
    mutationFn: () => api.market.rate(listing.id, { stars, comment }),
    onSuccess: () => {
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: LISTING_KEYS.viewer(listing.id) });
      router.refresh();
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (stars > 0) save.mutate();
  };

  if (state.myRating && !editing) {
    return (
      <div className={styles.panel} id="rate">
        <p className={styles.title}>Your rating</p>
        <Stars value={state.myRating.stars} size={20} />
        {state.myRating.comment ? <p className={styles.comment}>&ldquo;{state.myRating.comment}&rdquo;</p> : null}
        {state.canRate ? (
          <button type="button" className={styles.edit} onClick={() => setEditing(true)}>
            Change rating
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <form className={styles.panel} id="rate" onSubmit={submit}>
      <p className={styles.title}>You bought this from {listing.seller.displayName}</p>
      <p className={styles.text}>How did it go? Your rating shows on their profile. You can change it for {RATING_EDIT_DAYS} days.</p>
      <StarPicker value={stars} onChange={setStars} />
      <textarea className={styles.textarea} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={3} placeholder="Item as described? Easy to meet? (optional)" aria-label="Comment" />
      <FormError message={save.error instanceof ApiError ? save.error.message : null} />
      <Button type="submit" block disabled={stars === 0} loading={save.isPending} icon="star">
        {state.myRating ? 'Update rating' : 'Rate the seller'}
      </Button>
    </form>
  );
}
