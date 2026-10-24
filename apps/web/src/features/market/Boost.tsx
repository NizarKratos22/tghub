'use client';

import type { FeatureOrder, FeaturePlan } from '@tgh/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { FormError } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, Skeleton } from '@/components/ui/primitives';
import { Countdown } from '@/components/ui/time';
import { SignedIn } from '@/features/auth/session';
import { api, ApiError } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { formatDateTime } from '@/lib/format';
import styles from './Boost.module.css';

const PROVIDER_NOTE = {
  flouci: 'You pay on Flouci — card or Flouci wallet.',
  konnect: 'You pay on Konnect — card, wallet or e-DINAR.',
  dev: 'Test checkout: no money moves. Real payments switch on once Flouci or Konnect keys are set.',
} as const;

/** Pick a boost length, then go pay on the provider's page. */
export function FeatureDialog({ listingId, title, featuredUntil, onClose }: { listingId: string; title: string; featuredUntil: string | null; onClose: () => void }) {
  const config = useQuery({ queryKey: ['payments', 'config'], queryFn: api.payments.config, staleTime: 5 * 60_000 });
  const [plan, setPlan] = useState<FeaturePlan>('7d');
  const start = useMutation({
    mutationFn: () => api.payments.feature({ listingId, plan }),
    // Full navigation: the provider's checkout is its own page.
    onSuccess: (checkout) => window.location.assign(checkout.payUrl),
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !start.isPending && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, start.isPending]);

  const provider = config.data?.provider;
  return (
    <div className={styles.overlay} onClick={start.isPending ? undefined : onClose}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="feature-title" onClick={(event) => event.stopPropagation()}>
        <span className={styles.spark}>
          <Icon name="bolt" size={22} />
        </span>
        <h2 id="feature-title" className={styles.title}>
          Feature this listing
        </h2>
        <p className={styles.text}>
          &ldquo;{title}&rdquo; gets a <strong>Featured</strong> badge and a spot in the row at the top of the marketplace and its category.
          {featuredUntil ? ' Buying again adds days on top of the current boost.' : ''}
        </p>
        {config.isPending ? (
          <Skeleton height={120} />
        ) : !provider ? (
          <p className={styles.off}>Featuring listings isn&rsquo;t available yet.</p>
        ) : (
          <>
            <div className={styles.plans} role="radiogroup" aria-label="Length">
              {config.data!.plans.map((option) => (
                <button key={option.id} type="button" role="radio" aria-checked={plan === option.id} className={cx(styles.plan, plan === option.id && styles.planOn)} onClick={() => setPlan(option.id)}>
                  <span className={styles.planLabel}>{option.label}</span>
                  <span className={styles.planPrice}>
                    {option.priceTnd} <small>TND</small>
                  </span>
                  <span className={styles.planPer}>{(option.priceTnd / option.days).toFixed(2)} TND / day</span>
                  {option.id === '7d' ? <span className={styles.popular}>Most picked</span> : null}
                </button>
              ))}
            </div>
            <p className={cx(styles.note, provider === 'dev' && styles.noteDev)}>
              <Icon name={provider === 'dev' ? 'info' : 'lock'} size={14} /> {PROVIDER_NOTE[provider]}
            </p>
          </>
        )}
        <FormError message={start.error instanceof ApiError ? start.error.message : null} />
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose} disabled={start.isPending}>
            Cancel
          </Button>
          <Button icon="arrowRight" onClick={() => start.mutate()} loading={start.isPending} disabled={!provider}>
            Continue to payment
          </Button>
        </div>
      </div>
    </div>
  );
}

const POLL_MS = 3_000;
const POLL_LIMIT = 40;

function OrderView({ id }: { id: string }) {
  const [polls, setPolls] = useState(0);
  const order = useQuery({
    queryKey: ['payments', 'order', id],
    queryFn: async () => {
      setPolls((n) => n + 1);
      return api.payments.order(id);
    },
    // Never show a status cached from the checkout page; then keep checking for a couple of minutes.
    refetchOnMount: 'always',
    refetchInterval: (query) => (query.state.data?.status === 'pending' && polls < POLL_LIMIT ? POLL_MS : false),
  });

  if (order.isError) return <EmptyState icon="alert" title="Order not found" action={<ButtonLink href="/market/selling">Your listings</ButtonLink>} />;
  if (!order.data) return <Skeleton height={260} />;
  const data: FeatureOrder = order.data;

  return (
    <div className={styles.status}>
      {data.status === 'paid' ? (
        <>
          <span className={cx(styles.statusIcon, styles.ok)}>
            <Icon name="check" size={30} />
          </span>
          <h1>Your listing is featured</h1>
          <p>
            &ldquo;{data.listing.title}&rdquo; is in the featured row
            {data.listing.featuredUntil ? (
              <>
                {' '}
                until <strong>{formatDateTime(data.listing.featuredUntil)}</strong> (<Countdown iso={data.listing.featuredUntil} prefix="ends in" endedLabel="ended" />)
              </>
            ) : null}
            .
          </p>
        </>
      ) : data.status === 'pending' ? (
        <>
          <span className={cx(styles.statusIcon, styles.wait)}>
            <Icon name="clock" size={30} />
          </span>
          <h1>Confirming your payment…</h1>
          <p>{polls < POLL_LIMIT ? 'This usually takes a few seconds.' : 'Still waiting on the payment provider — we’ll keep checking and notify you as soon as it lands.'}</p>
        </>
      ) : (
        <>
          <span className={cx(styles.statusIcon, styles.bad)}>
            <Icon name="close" size={30} />
          </span>
          <h1>{data.status === 'expired' ? 'The payment timed out' : 'The payment didn’t go through'}</h1>
          <p>Nothing was charged for &ldquo;{data.listing.title}&rdquo;. You can try again from the listing.</p>
        </>
      )}
      <dl className={styles.receipt}>
        <div>
          <dt>Boost</dt>
          <dd>{data.days} days</dd>
        </div>
        <div>
          <dt>Price</dt>
          <dd>{data.priceTnd} TND</dd>
        </div>
        <div>
          <dt>Paid with</dt>
          <dd>{data.provider === 'dev' ? 'Test checkout' : data.provider === 'flouci' ? 'Flouci' : 'Konnect'}</dd>
        </div>
        <div>
          <dt>Order</dt>
          <dd>#{data.id.slice(-8).toUpperCase()}</dd>
        </div>
      </dl>
      <div className={styles.statusActions}>
        <ButtonLink href={`/market/item/${data.listing.id}`}>View listing</ButtonLink>
        <ButtonLink href="/market/selling" variant="outline">
          Your listings
        </ButtonLink>
      </div>
    </div>
  );
}

export function OrderStatus({ id }: { id: string }) {
  return <SignedIn prompt="Sign in to see this order">{() => <OrderView id={id} />}</SignedIn>;
}

/** Stands in for Flouci/Konnect in development, so the whole flow can be clicked through locally. */
export function DevCheckout({ id }: { id: string }) {
  const router = useRouter();
  const order = useQuery({ queryKey: ['payments', 'order', id], queryFn: () => api.payments.order(id) });
  const finish = useMutation({ mutationFn: (outcome: 'paid' | 'failed') => api.payments.devComplete(id, outcome), onSuccess: () => router.replace(`/market/boost/${id}`) });
  if (order.isError) return <EmptyState icon="alert" title="Order not found" />;
  if (!order.data) return <Skeleton height={300} />;
  return (
    <div className={styles.devCheckout}>
      <p className={styles.devBanner}>
        <Icon name="info" size={16} /> Test checkout — no money moves
      </p>
      <h1>Pay {order.data.priceTnd} TND</h1>
      <p>
        Feature &ldquo;{order.data.listing.title}&rdquo; for {order.data.days} days.
      </p>
      <div className={styles.fakeCard} aria-hidden>
        <span>4509 2111 1111 1119</span>
        <span>12/29 · 748</span>
      </div>
      <FormError message={finish.error?.message} />
      <div className={styles.statusActions}>
        <Button icon="check" onClick={() => finish.mutate('paid')} loading={finish.isPending && finish.variables === 'paid'} disabled={order.data.status !== 'pending'}>
          Pay (test)
        </Button>
        <Button variant="ghost" onClick={() => finish.mutate('failed')} loading={finish.isPending && finish.variables === 'failed'} disabled={order.data.status !== 'pending'}>
          Cancel payment
        </Button>
      </div>
      {order.data.status !== 'pending' ? (
        <p>
          This order is already {order.data.status}. <Link href={`/market/boost/${id}`}>See it</Link>
        </p>
      ) : null}
    </div>
  );
}
