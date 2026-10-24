'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  MARKET_REPORT_REASON_LABELS,
  MARKET_REPORT_REASONS,
  type ListingDetail,
  type ListingViewerState,
  type MarketReportReason,
  type SellerListingStatus,
} from '@tgh/shared';
import { Button, ButtonLink } from '@/components/ui/Button';
import { FormError } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Countdown } from '@/components/ui/time';
import { SESSION_KEY, useSession, useSignInHref } from '@/features/auth/session';
import { VerifyEmailNotice } from '@/features/auth/VerifyEmailBanner';
import { api, ApiError } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { LISTING_KEYS } from './meta';
import { FeatureDialog } from './Boost';
import { RatePanel } from './RatePanel';
import { SoldDialog } from './SoldDialog';
import styles from './ListingActions.module.css';

const GUEST_STATE: ListingViewerState = { isOwner: false, saved: false, reported: false, conversationId: null, renewableAt: null, canRate: false, myRating: null, buyers: [] };

function useViewer(listingId: string) {
  const { data: me, isPending } = useSession();
  const viewer = useQuery({
    queryKey: LISTING_KEYS.viewer(listingId),
    queryFn: () => api.market.viewer(listingId),
    enabled: Boolean(me),
  });
  return { me, loading: isPending || (Boolean(me) && viewer.isPending), state: me ? (viewer.data ?? GUEST_STATE) : GUEST_STATE };
}

/** One unique view per signed-in player per day (the API dedupes). */
function ViewPing({ listingId }: { listingId: string }) {
  const { data: me } = useSession();
  const sent = useRef(false);
  useEffect(() => {
    if (!me || sent.current) return;
    sent.current = true;
    void api.market.recordView(listingId).catch(() => undefined);
  }, [me, listingId]);
  return null;
}

function MessageBox({ listing, state }: { listing: ListingDetail; state: ListingViewerState }) {
  const router = useRouter();
  const signInHref = useSignInHref();
  const { data: me } = useSession();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('Hi, is this still available?');

  const send = useMutation({
    mutationFn: () => api.market.messageSeller(listing.id, body.trim()),
    onSuccess: ({ conversationId }) => {
      void queryClient.invalidateQueries({ queryKey: ['market', 'conversations'] });
      router.push(`/market/inbox/${conversationId}`);
    },
  });

  if (state.conversationId) {
    return (
      <div className={styles.box}>
        <p className={styles.boxTitle}>
          <Icon name="message" size={18} /> You&apos;re talking with the seller
        </p>
        <ButtonLink href={`/market/inbox/${state.conversationId}`} block icon="message">
          Open conversation
        </ButtonLink>
      </div>
    );
  }

  if (listing.status === 'sold') {
    return (
      <div className={styles.box}>
        <p className={styles.boxTitle}>This item has been sold</p>
        <p className={styles.boxText}>Browse similar listings or save a search by category.</p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className={styles.box}>
        <p className={styles.boxTitle}>
          <Icon name="message" size={18} /> Send seller a message
        </p>
        <ButtonLink href={signInHref} block>
          Log in to message
        </ButtonLink>
      </div>
    );
  }

  if (!me.emailVerified) return <VerifyEmailNotice action="message the seller" />;

  return (
    <form
      className={styles.box}
      onSubmit={(event) => {
        event.preventDefault();
        if (body.trim()) send.mutate();
      }}
    >
      <label htmlFor="seller-message" className={styles.boxTitle}>
        <Icon name="message" size={18} /> Send seller a message
      </label>
      <textarea id="seller-message" className={styles.textarea} value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} />
      <FormError message={send.error instanceof ApiError ? send.error.message : send.error ? 'Could not send — try again' : null} />
      <Button type="submit" block loading={send.isPending} disabled={!body.trim()}>
        Send
      </Button>
      {listing.status === 'pending' ? <p className={styles.boxText}>The seller marked this as pending — it may already be promised to someone.</p> : null}
    </form>
  );
}

function SaveButton({ listingId, saved }: { listingId: string; saved: boolean }) {
  const { data: me } = useSession();
  const router = useRouter();
  const signInHref = useSignInHref();
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: () => (saved ? api.me.removeBookmark('listing', listingId) : api.me.addBookmark('listing', listingId)),
    onMutate: () => {
      queryClient.setQueryData<ListingViewerState>(LISTING_KEYS.viewer(listingId), (state) => (state ? { ...state, saved: !saved } : state));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: LISTING_KEYS.viewer(listingId) });
      void queryClient.invalidateQueries({ queryKey: LISTING_KEYS.saved });
    },
  });
  return (
    <button
      type="button"
      className={cx(styles.tool, saved && styles.toolOn)}
      aria-pressed={saved}
      onClick={() => (me ? toggle.mutate() : router.push(signInHref))}
    >
      <Icon name="heart" size={18} filled={saved} />
      {saved ? 'Saved' : 'Save'}
    </button>
  );
}

function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={styles.tool}
      onClick={async () => {
        const url = window.location.href;
        if (navigator.share) {
          await navigator.share({ title, url }).catch(() => undefined);
          return;
        }
        await navigator.clipboard?.writeText(url).catch(() => undefined);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }}
    >
      <Icon name={copied ? 'check' : 'link'} size={18} />
      {copied ? 'Copied' : 'Share'}
    </button>
  );
}

function ReportPanel({ listingId, onDone }: { listingId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState<MarketReportReason | null>(null);
  const [details, setDetails] = useState('');
  const report = useMutation({
    mutationFn: () => api.market.report(listingId, { reason: reason!, details }),
    onSuccess: () => {
      queryClient.setQueryData<ListingViewerState>(LISTING_KEYS.viewer(listingId), (state) => (state ? { ...state, reported: true } : state));
      onDone();
    },
  });
  return (
    <form
      className={styles.report}
      onSubmit={(event) => {
        event.preventDefault();
        if (reason) report.mutate();
      }}
    >
      <p className={styles.boxTitle}>What&apos;s wrong with this listing?</p>
      <div className={styles.reasons} role="radiogroup" aria-label="Report reason">
        {MARKET_REPORT_REASONS.map((value) => (
          <label key={value} className={cx(styles.reason, reason === value && styles.reasonOn)}>
            <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} />
            {MARKET_REPORT_REASON_LABELS[value]}
          </label>
        ))}
      </div>
      <textarea
        className={styles.textarea}
        placeholder="Anything moderators should know (optional)"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        maxLength={500}
        rows={2}
      />
      <FormError message={report.error instanceof ApiError ? report.error.message : null} />
      <div className={styles.row}>
        <Button type="submit" variant="danger" size="sm" disabled={!reason} loading={report.isPending}>
          Send report
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function OwnerPanel({ listing, state }: { listing: ListingDetail; state: ListingViewerState }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: LISTING_KEYS.viewer(listing.id) });
    void queryClient.invalidateQueries({ queryKey: LISTING_KEYS.mine });
    router.refresh();
  };
  const status = useMutation({ mutationFn: (next: SellerListingStatus) => api.market.setStatus(listing.id, next), onSuccess: refresh });
  const [selling, setSelling] = useState(false);
  const [featuring, setFeaturing] = useState(false);
  const renew = useMutation({ mutationFn: () => api.market.renew(listing.id), onSuccess: refresh });
  const remove = useMutation({
    mutationFn: () => api.market.remove(listing.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LISTING_KEYS.mine });
      void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      router.push('/market/selling');
    },
  });
  const error = [status.error, renew.error, remove.error].find(Boolean);

  return (
    <div className={styles.box}>
      <p className={styles.boxTitle}>
        <Icon name="tag" size={18} /> Your listing
      </p>
      <p className={styles.boxText}>
        {listing.views} views · {listing.saves} saves
      </p>
      {listing.status === 'active' ? (
        <button type="button" className={styles.featureCta} onClick={() => setFeaturing(true)}>
          <Icon name="bolt" size={16} />
          <span>
            <strong>{listing.featured ? 'Featured — add more days' : 'Feature this listing'}</strong>
            <span>Top of the marketplace with a Featured badge, from 5 TND</span>
          </span>
          <Icon name="chevronRight" size={16} />
        </button>
      ) : null}
      <div className={styles.ownerGrid}>
        {listing.status !== 'sold' ? (
          <Button size="sm" variant="primary" icon="check" onClick={() => setSelling(true)}>
            Mark as sold
          </Button>
        ) : null}
        {listing.status === 'active' ? (
          <Button size="sm" variant="secondary" onClick={() => status.mutate('pending')} loading={status.isPending && status.variables === 'pending'}>
            Mark as pending
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => status.mutate('active')} loading={status.isPending && status.variables === 'active'}>
            Mark as available
          </Button>
        )}
        <ButtonLink href={`/market/item/${listing.id}/edit`} size="sm" variant="outline" icon="edit">
          Edit
        </ButtonLink>
        {listing.status === 'active' ? (
          state.renewableAt ? (
            <span className={styles.renewWait}>
              <Countdown iso={state.renewableAt} prefix="Renew in" endedLabel="Renew available" />
            </span>
          ) : (
            <Button size="sm" variant="outline" icon="refresh" onClick={() => renew.mutate()} loading={renew.isPending}>
              Renew
            </Button>
          )
        ) : null}
        <Button
          size="sm"
          variant="danger"
          icon="trash"
          onClick={() => {
            if (window.confirm('Delete this listing? Buyers will no longer see it.')) remove.mutate();
          }}
          loading={remove.isPending}
        >
          Delete
        </Button>
      </div>
      <FormError message={error instanceof ApiError ? error.message : null} />
      {selling ? (
        <SoldDialog
          listingId={listing.id}
          title={listing.title}
          onClose={() => setSelling(false)}
          onDone={() => {
            setSelling(false);
            refresh();
          }}
        />
      ) : null}
      {featuring ? <FeatureDialog listingId={listing.id} title={listing.title} featuredUntil={listing.featured ? 'active' : null} onClose={() => setFeaturing(false)} /> : null}
    </div>
  );
}

export function ListingActions({ listing }: { listing: ListingDetail }) {
  const { loading, state } = useViewer(listing.id);
  const [reporting, setReporting] = useState(false);

  return (
    <div className={styles.actions}>
      <ViewPing listingId={listing.id} />
      {loading ? <div className={cx(styles.box, styles.loading)} aria-hidden /> : state.isOwner ? <OwnerPanel listing={listing} state={state} /> : <MessageBox listing={listing} state={state} />}
      {!loading && (state.canRate || state.myRating) ? <RatePanel listing={listing} state={state} /> : null}
      {!state.isOwner ? (
        <div className={styles.tools}>
          <SaveButton listingId={listing.id} saved={state.saved} />
          <ShareButton title={listing.title} />
          {state.reported ? (
            <span className={cx(styles.tool, styles.toolMuted)}>
              <Icon name="flag" size={18} /> Reported
            </span>
          ) : (
            <button type="button" className={styles.tool} onClick={() => setReporting((open) => !open)} aria-expanded={reporting}>
              <Icon name="flag" size={18} /> Report
            </button>
          )}
        </div>
      ) : (
        <div className={styles.tools}>
          <ShareButton title={listing.title} />
        </div>
      )}
      {reporting && !state.reported ? <ReportPanel listingId={listing.id} onDone={() => setReporting(false)} /> : null}
    </div>
  );
}
