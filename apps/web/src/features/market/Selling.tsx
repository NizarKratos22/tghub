'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { LISTING_STATUS_LABELS, type MyListing, type SellerListingStatus } from '@tgh/shared';
import { Button, ButtonLink } from '@/components/ui/Button';
import { FormError } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, Skeleton, Tag } from '@/components/ui/primitives';
import { Countdown, RelativeTime } from '@/components/ui/time';
import { SESSION_KEY, SignedIn } from '@/features/auth/session';
import { api, ApiError } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { formatTnd } from '@/lib/format';
import { ListingGrid } from './ListingCard';
import { LISTING_KEYS } from './meta';
import { FeatureDialog } from './Boost';
import { SoldDialog } from './SoldDialog';
import styles from './Selling.module.css';

type Filter = 'all' | SellerListingStatus;
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'sold', label: 'Sold' },
];

function Row({ item }: { item: MyListing }) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: LISTING_KEYS.mine });
    void queryClient.invalidateQueries({ queryKey: LISTING_KEYS.viewer(item.id) });
  };
  const status = useMutation({ mutationFn: (next: SellerListingStatus) => api.market.setStatus(item.id, next), onSuccess: refresh });
  const [selling, setSelling] = useState(false);
  const [featuring, setFeaturing] = useState(false);
  const renew = useMutation({ mutationFn: () => api.market.renew(item.id), onSuccess: refresh });
  const remove = useMutation({
    mutationFn: () => api.market.remove(item.id),
    onSuccess: () => {
      refresh();
      void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    },
  });
  const error = [status.error, renew.error, remove.error].find(Boolean);
  const removed = item.status === 'removed';

  return (
    <li className={cx(styles.row, removed && styles.removed)}>
      <Link href={removed ? '#' : `/market/item/${item.id}`} className={styles.photo} aria-disabled={removed}>
        {item.photo ? <img src={item.photo.thumbUrl} alt="" width={96} height={96} /> : <Icon name="image" size={22} />}
      </Link>
      <div className={styles.main}>
        <div className={styles.titleRow}>
          {removed ? <span className={styles.title}>{item.title}</span> : <Link href={`/market/item/${item.id}`} className={styles.title}>{item.title}</Link>}
          <Tag tone={item.status === 'active' ? 'success' : item.status === 'pending' ? 'gold' : item.status === 'sold' ? 'solid' : 'danger'}>
            {LISTING_STATUS_LABELS[item.status]}
          </Tag>
        </div>
        <p className={styles.price}>{formatTnd(item.price)}</p>
        <p className={styles.stats}>
          <span>
            <Icon name="eye" size={14} /> {item.views}
          </span>
          <span>
            <Icon name="heart" size={14} /> {item.saves}
          </span>
          <span>
            <Icon name="message" size={14} /> {item.conversations}
          </span>
          <span>
            Listed <RelativeTime iso={item.bumpedAt} />
          </span>
        </p>
        {removed ? (
          <p className={styles.note}>
            <Icon name="alert" size={15} /> Removed by moderators{item.moderationNote ? `: ${item.moderationNote}` : '.'}
          </p>
        ) : null}
        {item.featuredUntil ? (
          <p className={styles.featuredLine}>
            <Icon name="bolt" size={14} /> Featured · <Countdown iso={item.featuredUntil} prefix="ends in" endedLabel="ended" />
          </p>
        ) : null}
        {item.status === 'sold' ? (
          <p className={styles.soldTo}>
            {item.buyer ? (
              <>
                Sold to <Link href={`/u/${item.buyer.username}`}>{item.buyer.displayName}</Link> — they can rate you
              </>
            ) : (
              'Sold outside TG Hub'
            )}
          </p>
        ) : null}
        <FormError message={error instanceof ApiError ? error.message : null} />
        {featuring ? <FeatureDialog listingId={item.id} title={item.title} featuredUntil={item.featuredUntil} onClose={() => setFeaturing(false)} /> : null}
        {selling ? (
          <SoldDialog
            listingId={item.id}
            title={item.title}
            onClose={() => setSelling(false)}
            onDone={() => {
              setSelling(false);
              refresh();
            }}
          />
        ) : null}
      </div>
      {!removed ? (
        <div className={styles.actions}>
          {item.status !== 'sold' ? (
            <Button size="sm" icon="check" onClick={() => setSelling(true)}>
              Mark sold
            </Button>
          ) : null}
          {item.status === 'active' ? (
            <Button size="sm" variant="gold" icon="bolt" onClick={() => setFeaturing(true)}>
              {item.featuredUntil ? 'Extend' : 'Feature'}
            </Button>
          ) : null}
          {item.status === 'active' ? (
            <Button size="sm" variant="secondary" onClick={() => status.mutate('pending')} loading={status.isPending && status.variables === 'pending'}>
              Mark pending
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => status.mutate('active')} loading={status.isPending && status.variables === 'active'}>
              Relist
            </Button>
          )}
          {item.status === 'active' ? (
            item.renewableAt ? (
              <span className={styles.wait}>
                <Countdown iso={item.renewableAt} prefix="Renew in" endedLabel="Renew now" />
              </span>
            ) : (
              <Button size="sm" variant="outline" icon="refresh" onClick={() => renew.mutate()} loading={renew.isPending}>
                Renew
              </Button>
            )
          ) : null}
          <ButtonLink href={`/market/item/${item.id}/edit`} size="sm" variant="ghost" icon="edit">
            Edit
          </ButtonLink>
          <Button
            size="sm"
            variant="ghost"
            icon="trash"
            aria-label="Delete listing"
            onClick={() => {
              if (window.confirm(`Delete "${item.title}"?`)) remove.mutate();
            }}
            loading={remove.isPending}
          />
        </div>
      ) : null}
    </li>
  );
}

function SellingList() {
  const [filter, setFilter] = useState<Filter>('all');
  const mine = useQuery({ queryKey: LISTING_KEYS.mine, queryFn: () => api.market.mine() });

  if (mine.isPending) return <Skeleton height={320} />;
  if (mine.isError) return <EmptyState icon="alert" title="Could not load your listings">Refresh the page to try again.</EmptyState>;

  const { items, counts } = mine.data;
  const visible = filter === 'all' ? items : items.filter((item) => item.status === filter);
  const totalViews = items.reduce((sum, item) => sum + item.views, 0);
  const totalChats = items.reduce((sum, item) => sum + item.conversations, 0);

  return (
    <div className={styles.wrap}>
      <ul className={styles.summary}>
        <li>
          <strong>{counts.active}</strong>
          <span>Active</span>
        </li>
        <li>
          <strong>{counts.pending}</strong>
          <span>Pending</span>
        </li>
        <li>
          <strong>{counts.sold}</strong>
          <span>Sold</span>
        </li>
        <li>
          <strong>{totalViews}</strong>
          <span>Views</span>
        </li>
        <li>
          <strong>{totalChats}</strong>
          <span>Chats</span>
        </li>
      </ul>

      <div className={styles.filters} role="tablist" aria-label="Filter listings">
        {FILTERS.map((item) => (
          <button key={item.value} type="button" role="tab" aria-selected={filter === item.value} className={cx(styles.filter, filter === item.value && styles.filterOn)} onClick={() => setFilter(item.value)}>
            {item.label}
          </button>
        ))}
      </div>

      {visible.length > 0 ? (
        <ul className={styles.list}>
          {visible.map((item) => (
            <Row key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <EmptyState icon="tag" title={items.length === 0 ? "You haven't listed anything yet" : 'Nothing here'} action={<ButtonLink href="/market/sell" icon="plus">Create new listing</ButtonLink>}>
          {items.length === 0 ? 'Old consoles, spare parts, scripts you built — list them in a minute.' : 'Try another filter.'}
        </EmptyState>
      )}
    </div>
  );
}

export function SellingDashboard() {
  return (
    <SignedIn prompt="Sign in to manage your listings" loading={<Skeleton height={320} />}>
      {() => <SellingList />}
    </SignedIn>
  );
}

function SavedList() {
  const saved = useQuery({ queryKey: LISTING_KEYS.saved, queryFn: api.market.saved });
  if (saved.isPending) return <Skeleton height={320} />;
  if ((saved.data ?? []).length === 0) {
    return (
      <EmptyState icon="heart" title="No saved items" action={<ButtonLink href="/market">Browse the marketplace</ButtonLink>}>
        Tap Save on any listing to keep it here.
      </EmptyState>
    );
  }
  return <ListingGrid listings={saved.data!} />;
}

export function SavedListings() {
  return (
    <SignedIn prompt="Sign in to see saved items" loading={<Skeleton height={320} />}>
      {() => <SavedList />}
    </SignedIn>
  );
}
