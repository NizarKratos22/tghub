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
import { fill } from '@/i18n/config';
import { useFormat, useT } from '@/i18n/I18nProvider';
import { api, ApiError } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import styles from './Boost.module.css';

/** Pick a boost length, then go pay on the provider's page. */
export function FeatureDialog({ listingId, title, featuredUntil, onClose }: { listingId: string; title: string; featuredUntil: string | null; onClose: () => void }) {
  const t = useT();
  const format = useFormat();
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
          {t.boost.title}
        </h2>
        <p className={styles.text}>
          {fill(t.boost.text, { title })}
          {featuredUntil ? ` ${t.boost.addsDays}` : ''}
        </p>
        {config.isPending ? (
          <Skeleton height={120} />
        ) : !provider ? (
          <p className={styles.off}>{t.boost.unavailable}</p>
        ) : (
          <>
            <div className={styles.plans} role="radiogroup" aria-label={t.boost.length}>
              {config.data!.plans.map((option) => (
                <button key={option.id} type="button" role="radio" aria-checked={plan === option.id} className={cx(styles.plan, plan === option.id && styles.planOn)} onClick={() => setPlan(option.id)}>
                  <span className={styles.planLabel}>{t.boost.plans[option.id]}</span>
                  <span className={styles.planPrice}>{format.tnd(option.priceTnd)}</span>
                  <span className={styles.planPer}>{fill(t.boost.perDay, { price: (option.priceTnd / option.days).toFixed(2) })}</span>
                  {option.id === '7d' ? <span className={styles.popular}>{t.boost.mostPicked}</span> : null}
                </button>
              ))}
            </div>
            <p className={cx(styles.note, provider === 'dev' && styles.noteDev)}>
              <Icon name={provider === 'dev' ? 'info' : 'lock'} size={14} /> {t.boost.providerNote[provider]}
            </p>
          </>
        )}
        <FormError message={start.error instanceof ApiError ? start.error.message : null} />
        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose} disabled={start.isPending}>
            {t.common.cancel}
          </Button>
          <Button icon="arrowRight" onClick={() => start.mutate()} loading={start.isPending} disabled={!provider}>
            {t.boost.continue}
          </Button>
        </div>
      </div>
    </div>
  );
}

const POLL_MS = 3_000;
const POLL_LIMIT = 40;

function OrderView({ id }: { id: string }) {
  const t = useT();
  const format = useFormat();
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

  if (order.isError) return <EmptyState icon="alert" title={t.boost.orderNotFound} action={<ButtonLink href="/market/selling">{t.boost.yourListings}</ButtonLink>} />;
  if (!order.data) return <Skeleton height={260} />;
  const data: FeatureOrder = order.data;

  return (
    <div className={styles.status}>
      {data.status === 'paid' ? (
        <>
          <span className={cx(styles.statusIcon, styles.ok)}>
            <Icon name="check" size={30} />
          </span>
          <h1>{t.boost.featuredTitle}</h1>
          <p>
            {fill(t.boost.inRow, { title: data.listing.title })}
            {data.listing.featuredUntil ? (
              <>
                {' '}
                {t.boost.until} <strong>{format.dateTime(data.listing.featuredUntil)}</strong> (
                <Countdown iso={data.listing.featuredUntil} label={t.selling.featuredEnds} endedLabel={t.selling.featuredEnded} />)
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
          <h1>{t.boost.confirming}</h1>
          <p>{polls < POLL_LIMIT ? t.boost.fewSeconds : t.boost.stillWaiting}</p>
        </>
      ) : (
        <>
          <span className={cx(styles.statusIcon, styles.bad)}>
            <Icon name="close" size={30} />
          </span>
          <h1>{data.status === 'expired' ? t.boost.timedOut : t.boost.failed}</h1>
          <p>{fill(t.boost.nothingCharged, { title: data.listing.title })}</p>
        </>
      )}
      <dl className={styles.receipt}>
        <div>
          <dt>{t.boost.boost}</dt>
          <dd>{format.fill(t.boost.days, { count: data.days })}</dd>
        </div>
        <div>
          <dt>{t.boost.price}</dt>
          <dd>{format.tnd(data.priceTnd)}</dd>
        </div>
        <div>
          <dt>{t.boost.paidWith}</dt>
          <dd>{data.provider === 'dev' ? t.boost.testCheckout : data.provider === 'flouci' ? 'Flouci' : 'Konnect'}</dd>
        </div>
        <div>
          <dt>{t.boost.order}</dt>
          <dd>#{data.id.slice(-8).toUpperCase()}</dd>
        </div>
      </dl>
      <div className={styles.statusActions}>
        <ButtonLink href={`/market/item/${data.listing.id}`}>{t.boost.viewListing}</ButtonLink>
        <ButtonLink href="/market/selling" variant="outline">
          {t.boost.yourListings}
        </ButtonLink>
      </div>
    </div>
  );
}

export function OrderStatus({ id }: { id: string }) {
  const t = useT();
  return <SignedIn prompt={t.boost.signIn}>{() => <OrderView id={id} />}</SignedIn>;
}

/** Stands in for Flouci/Konnect in development, so the whole flow can be clicked through locally. */
export function DevCheckout({ id }: { id: string }) {
  const t = useT();
  const format = useFormat();
  const router = useRouter();
  const order = useQuery({ queryKey: ['payments', 'order', id], queryFn: () => api.payments.order(id) });
  const finish = useMutation({ mutationFn: (outcome: 'paid' | 'failed') => api.payments.devComplete(id, outcome), onSuccess: () => router.replace(`/market/boost/${id}`) });
  if (order.isError) return <EmptyState icon="alert" title={t.boost.orderNotFound} />;
  if (!order.data) return <Skeleton height={300} />;
  return (
    <div className={styles.devCheckout}>
      <p className={styles.devBanner}>
        <Icon name="info" size={16} /> {t.boost.testBanner}
      </p>
      <h1>{fill(t.boost.pay, { price: order.data.priceTnd })}</h1>
      <p>{format.fill(t.boost.featureFor, { title: order.data.listing.title, days: order.data.days })}</p>
      <div className={styles.fakeCard} aria-hidden>
        <span>4509 2111 1111 1119</span>
        <span>12/29 · 748</span>
      </div>
      <FormError message={finish.error?.message} />
      <div className={styles.statusActions}>
        <Button icon="check" onClick={() => finish.mutate('paid')} loading={finish.isPending && finish.variables === 'paid'} disabled={order.data.status !== 'pending'}>
          {t.boost.payTest}
        </Button>
        <Button variant="ghost" onClick={() => finish.mutate('failed')} loading={finish.isPending && finish.variables === 'failed'} disabled={order.data.status !== 'pending'}>
          {t.boost.cancelPayment}
        </Button>
      </div>
      {order.data.status !== 'pending' ? (
        <p>
          {fill(t.boost.already, { status: t.boost.status[order.data.status] })} <Link href={`/market/boost/${id}`}>{t.boost.seeIt}</Link>
        </p>
      ) : null}
    </div>
  );
}
