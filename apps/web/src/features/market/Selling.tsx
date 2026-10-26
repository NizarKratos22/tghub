'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import type { MyListing, SellerListingStatus } from '@tgh/shared';
import { Button, ButtonLink } from '@/components/ui/Button';
import { FormError } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, Skeleton, Tag } from '@/components/ui/primitives';
import { Countdown, RelativeTime } from '@/components/ui/time';
import { SESSION_KEY, SignedIn } from '@/features/auth/session';
import { fill } from '@/i18n/config';
import { useFormat, useT } from '@/i18n/I18nProvider';
import { api, ApiError } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { ListingGrid } from './ListingCard';
import { LISTING_KEYS } from './meta';
import { FeatureDialog } from './Boost';
import { SoldDialog } from './SoldDialog';
import styles from './Selling.module.css';

type Filter = 'all' | SellerListingStatus;
const FILTERS: Filter[] = ['all', 'active', 'pending', 'sold'];

function Row({ item }: { item: MyListing }) {
  const t = useT();
  const format = useFormat();
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
            {t.labels.listingStatus[item.status]}
          </Tag>
        </div>
        <p className={styles.price}>{format.tnd(item.price)}</p>
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
            {t.selling.listed} <RelativeTime iso={item.bumpedAt} />
          </span>
        </p>
        {removed ? (
          <p className={styles.note}>
            <Icon name="alert" size={15} /> {item.moderationNote ? fill(t.selling.removedNote, { note: item.moderationNote }) : t.selling.removed}
          </p>
        ) : null}
        {item.featuredUntil ? (
          <p className={styles.featuredLine}>
            <Icon name="bolt" size={14} /> {t.selling.featured} · <Countdown iso={item.featuredUntil} label={t.selling.featuredEnds} endedLabel={t.selling.featuredEnded} />
          </p>
        ) : null}
        {item.status === 'sold' ? (
          <p className={styles.soldTo}>
            {item.buyer ? (
              <>
                {t.selling.soldTo} <Link href={`/u/${item.buyer.username}`}>{item.buyer.displayName}</Link> {t.selling.canRate}
              </>
            ) : (
              t.selling.soldOutside
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
              {t.selling.markSold}
            </Button>
          ) : null}
          {item.status === 'active' ? (
            <Button size="sm" variant="gold" icon="bolt" onClick={() => setFeaturing(true)}>
              {item.featuredUntil ? t.selling.extend : t.selling.feature}
            </Button>
          ) : null}
          {item.status === 'active' ? (
            <Button size="sm" variant="secondary" onClick={() => status.mutate('pending')} loading={status.isPending && status.variables === 'pending'}>
              {t.selling.markPending}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => status.mutate('active')} loading={status.isPending && status.variables === 'active'}>
              {t.selling.relist}
            </Button>
          )}
          {item.status === 'active' ? (
            item.renewableAt ? (
              <span className={styles.wait}>
                <Countdown iso={item.renewableAt} label={t.selling.renewIn} endedLabel={t.selling.renewNow} />
              </span>
            ) : (
              <Button size="sm" variant="outline" icon="refresh" onClick={() => renew.mutate()} loading={renew.isPending}>
                {t.selling.renew}
              </Button>
            )
          ) : null}
          <ButtonLink href={`/market/item/${item.id}/edit`} size="sm" variant="ghost" icon="edit">
            {t.selling.edit}
          </ButtonLink>
          <Button
            size="sm"
            variant="ghost"
            icon="trash"
            aria-label={t.selling.delete}
            onClick={() => {
              if (window.confirm(fill(t.selling.confirmDelete, { title: item.title }))) remove.mutate();
            }}
            loading={remove.isPending}
          />
        </div>
      ) : null}
    </li>
  );
}

function SellingList() {
  const t = useT();
  const format = useFormat();
  const filterLabel: Record<Filter, string> = { all: t.common.all, active: t.labels.listingStatus.active, pending: t.labels.listingStatus.pending, sold: t.labels.listingStatus.sold };
  const [filter, setFilter] = useState<Filter>('all');
  const mine = useQuery({ queryKey: LISTING_KEYS.mine, queryFn: () => api.market.mine() });

  if (mine.isPending) return <Skeleton height={320} />;
  if (mine.isError) return <EmptyState icon="alert" title={t.selling.loadFailed}>{t.selling.refresh}</EmptyState>;

  const { items, counts } = mine.data;
  const visible = filter === 'all' ? items : items.filter((item) => item.status === filter);
  const totalViews = items.reduce((sum, item) => sum + item.views, 0);
  const totalChats = items.reduce((sum, item) => sum + item.conversations, 0);

  return (
    <div className={styles.wrap}>
      <ul className={styles.summary}>
        <li>
          <strong>{format.number(counts.active)}</strong>
          <span>{t.labels.listingStatus.active}</span>
        </li>
        <li>
          <strong>{format.number(counts.pending)}</strong>
          <span>{t.labels.listingStatus.pending}</span>
        </li>
        <li>
          <strong>{format.number(counts.sold)}</strong>
          <span>{t.labels.listingStatus.sold}</span>
        </li>
        <li>
          <strong>{format.number(totalViews)}</strong>
          <span>{t.selling.views}</span>
        </li>
        <li>
          <strong>{format.number(totalChats)}</strong>
          <span>{t.selling.chats}</span>
        </li>
      </ul>

      <div className={styles.filters} role="tablist" aria-label={t.selling.filter}>
        {FILTERS.map((value) => (
          <button key={value} type="button" role="tab" aria-selected={filter === value} className={cx(styles.filter, filter === value && styles.filterOn)} onClick={() => setFilter(value)}>
            {filterLabel[value]}
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
        <EmptyState icon="tag" title={items.length === 0 ? t.selling.emptyTitle : t.selling.nothingHere} action={<ButtonLink href="/market/sell" icon="plus">{t.market.createListing}</ButtonLink>}>
          {items.length === 0 ? t.selling.emptyText : t.selling.tryFilter}
        </EmptyState>
      )}
    </div>
  );
}

export function SellingDashboard() {
  const t = useT();
  return (
    <SignedIn prompt={t.selling.signInPrompt} loading={<Skeleton height={320} />}>
      {() => <SellingList />}
    </SignedIn>
  );
}

function SavedList() {
  const t = useT();
  const saved = useQuery({ queryKey: LISTING_KEYS.saved, queryFn: api.market.saved });
  if (saved.isPending) return <Skeleton height={320} />;
  if ((saved.data ?? []).length === 0) {
    return (
      <EmptyState icon="heart" title={t.selling.noSaved} action={<ButtonLink href="/market">{t.selling.browse}</ButtonLink>}>
        {t.selling.noSavedText}
      </EmptyState>
    );
  }
  return <ListingGrid listings={saved.data!} />;
}

export function SavedListings() {
  const t = useT();
  return (
    <SignedIn prompt={t.selling.signInSaved} loading={<Skeleton height={320} />}>
      {() => <SavedList />}
    </SignedIn>
  );
}
