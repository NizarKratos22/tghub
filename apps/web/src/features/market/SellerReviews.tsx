'use client';

import type { SellerRating, SellerReputation } from '@tgh/shared';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/primitives';
import { RelativeTime } from '@/components/ui/time';
import { useSession } from '@/features/auth/session';
import { useFormat, useT } from '@/i18n/I18nProvider';
import { api } from '@/lib/api/client';
import { RatingBars, Stars, VerifiedSeller } from './reputation';
import styles from './SellerReviews.module.css';

function ReplyForm({ rating, onDone }: { rating: SellerRating; onDone: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const reply = useMutation({ mutationFn: () => api.market.replyRating(rating.id, text), onSuccess: onDone });
  if (!open) {
    return (
      <button type="button" className={styles.replyLink} onClick={() => setOpen(true)}>
        {t.reputation.reply}
      </button>
    );
  }
  return (
    <div className={styles.replyForm}>
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={2} placeholder={t.reputation.replyPlaceholder} aria-label={t.reputation.reply} autoFocus />
      <div>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {t.common.cancel}
        </Button>
        <Button size="sm" onClick={() => reply.mutate()} loading={reply.isPending} disabled={!text.trim()}>
          {t.reputation.postReply}
        </Button>
      </div>
      {reply.error ? <p className={styles.error}>{reply.error.message}</p> : null}
    </div>
  );
}

/** Marketplace reputation on a profile: summary, star bars and the reviews themselves. */
export function SellerReviews({ username, reputation }: { username: string; reputation: SellerReputation }) {
  const t = useT();
  const format = useFormat();
  const { data: me } = useSession();
  const queryClient = useQueryClient();
  const key = ['market', 'ratings', username];
  const pages = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => api.market.sellerRatings(username, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: reputation.count > 0,
  });
  const ratings = pages.data?.pages.flatMap((page) => page.items) ?? [];
  const own = me?.username === username;

  return (
    <div className={styles.wrap}>
      <div className={styles.summary}>
        <div className={styles.score}>
          <strong>{reputation.average?.toFixed(1) ?? '—'}</strong>
          <Stars value={reputation.average ?? 0} size={18} />
          <span>
            {format.fill(t.reputation.ratings, { count: reputation.count })} · {format.fill(t.reputation.sales, { count: reputation.sales })}
          </span>
          {reputation.verified ? <VerifiedSeller /> : null}
        </div>
        <RatingBars reputation={reputation} />
      </div>
      {ratings.length > 0 ? (
        <ul className={styles.list}>
          {ratings.map((rating) => (
            <li key={rating.id} className={styles.item}>
              <div className={styles.head}>
                <Link href={`/u/${rating.buyer.username}`} className={styles.buyer}>
                  <Avatar name={rating.buyer.displayName} color={rating.buyer.avatarColor} src={rating.buyer.avatarUrl} size={32} />
                  <strong>{rating.buyer.displayName}</strong>
                </Link>
                <Stars value={rating.stars} />
                <RelativeTime iso={rating.createdAt} className={styles.time} />
              </div>
              {rating.comment ? <p className={styles.comment} dir="auto">{rating.comment}</p> : null}
              <p className={styles.listing}>
                {t.reputation.bought} <Link href={`/market/item/${rating.listing.id}`}>{rating.listing.title}</Link>
              </p>
              {rating.reply ? (
                <p className={styles.reply}>
                  <strong>{t.reputation.sellerReply}</strong> {rating.reply}
                </p>
              ) : own ? (
                <ReplyForm rating={rating} onDone={() => void queryClient.invalidateQueries({ queryKey: key })} />
              ) : null}
            </li>
          ))}
        </ul>
      ) : reputation.count === 0 ? (
        <p className={styles.empty}>{t.reputation.empty}</p>
      ) : null}
      {pages.hasNextPage ? (
        <Button variant="ghost" onClick={() => pages.fetchNextPage()} loading={pages.isFetchingNextPage}>
          {t.reputation.more}
        </Button>
      ) : null}
    </div>
  );
}
