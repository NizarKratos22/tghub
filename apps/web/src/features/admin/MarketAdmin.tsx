'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { LISTING_STATUS_LABELS, MARKET_REPORT_FLAG_THRESHOLD, MARKET_REPORT_REASON_LABELS, type AdminListing } from '@tgh/shared';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, Skeleton, Tag } from '@/components/ui/primitives';
import { RelativeTime } from '@/components/ui/time';
import { api } from '@/lib/api/client';
import { formatTnd } from '@/lib/format';
import styles from './admin.module.css';

type View = 'flagged' | 'active' | 'removed' | 'all';
const VIEWS: Array<{ id: View; label: string; query: Record<string, string | boolean | undefined> }> = [
  { id: 'flagged', label: 'Flagged', query: { flagged: true } },
  { id: 'active', label: 'Active', query: { status: 'active' } },
  { id: 'removed', label: 'Removed', query: { status: 'removed' } },
  { id: 'all', label: 'All', query: {} },
];

function Panel({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className={styles.panel}>
      <header className={styles.panelHead}>
        <h2>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

function Reports({ listingId }: { listingId: string }) {
  const reports = useQuery({ queryKey: ['admin', 'market', 'reports', listingId], queryFn: () => api.admin.market.reports(listingId) });
  if (!reports.data) return <Skeleton height={60} />;
  if (reports.data.length === 0) return <p className={styles.dim}>No reports.</p>;
  return (
    <ul className={styles.targets}>
      {reports.data.map((report) => (
        <li key={report.id}>
          <span>
            <Tag tone="danger">{MARKET_REPORT_REASON_LABELS[report.reason]}</Tag> {report.details || <span className={styles.dim}>No details</span>}
          </span>
          <span className={styles.dim}>
            @{report.reporter.username} · <RelativeTime iso={report.createdAt} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Row({ listing, onChanged }: { listing: AdminListing; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const update = useMutation({ mutationFn: (body: Record<string, unknown>) => api.admin.market.update(listing.id, body), onSuccess: onChanged });
  const live = listing.status === 'active' || listing.status === 'pending' || listing.status === 'sold';

  return (
    <>
      <tr>
        <td>
          {listing.photo ? <img src={listing.photo.thumbUrl} alt="" className={styles.thumb} /> : <span className={styles.thumb} />}
        </td>
        <td>
          {live ? (
            <Link href={`/market/item/${listing.id}`} target="_blank" className={styles.cellTitle}>
              {listing.title}
            </Link>
          ) : (
            <span className={styles.cellTitle}>{listing.title}</span>
          )}
          <div className={styles.dim}>
            @{listing.seller.username} · {formatTnd(listing.price)} · <RelativeTime iso={listing.createdAt} />
          </div>
          {listing.moderationNote ? <div className={styles.dim}>Note: {listing.moderationNote}</div> : null}
        </td>
        <td>
          <Tag tone={listing.status === 'removed' ? 'danger' : listing.status === 'active' ? 'success' : 'muted'}>{LISTING_STATUS_LABELS[listing.status]}</Tag>
          {listing.flagged ? (
            <>
              {' '}
              <Tag tone="gold">Flagged</Tag>
            </>
          ) : null}
        </td>
        <td>
          <button type="button" className={styles.linkButton} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            <Icon name="flag" size={13} /> {listing.reports} report{listing.reports === 1 ? '' : 's'}
            <Icon name={open ? 'chevronDown' : 'chevronRight'} size={13} />
          </button>
          <div>
            {listing.reportReasons.map((reason) => (
              <Tag key={reason} tone="line">
                {MARKET_REPORT_REASON_LABELS[reason]}
              </Tag>
            ))}
          </div>
        </td>
        <td>
          <div className={styles.actions}>
            {listing.status !== 'removed' ? (
              <Button
                size="sm"
                variant="danger"
                loading={update.isPending}
                onClick={() => {
                  const note = window.prompt('Reason shown to the seller', listing.reportReasons.includes('leaked') ? 'Leaked or resold asset without permission' : 'Breaks the marketplace rules');
                  if (note !== null) update.mutate({ status: 'removed', moderationNote: note });
                }}
              >
                Remove
              </Button>
            ) : (
              <Button size="sm" variant="secondary" loading={update.isPending} onClick={() => update.mutate({ status: 'active' })}>
                Restore
              </Button>
            )}
            {listing.flagged && listing.status !== 'removed' ? (
              <Button size="sm" variant="ghost" loading={update.isPending} onClick={() => update.mutate({ flagged: false })}>
                Dismiss
              </Button>
            ) : null}
          </div>
          <FormError message={update.error?.message} />
        </td>
      </tr>
      {open ? (
        <tr>
          <td />
          <td colSpan={4}>
            <Reports listingId={listing.id} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function MarketAdmin() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>('flagged');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const query = { ...VIEWS.find((v) => v.id === view)!.query, q: q.trim() || undefined, page, pageSize: 20 };
  const list = useQuery({ queryKey: ['admin', 'market', query], queryFn: () => api.admin.market.listings(query) });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'market'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
  };

  return (
    <Panel
      title="Marketplace moderation"
      aside={<input className={styles.searchInput} placeholder="Search listings" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search listings" />}
    >
      <div className={styles.viewTabs}>
        {VIEWS.map((item) => (
          <Button key={item.id} size="sm" variant={view === item.id ? 'secondary' : 'ghost'} onClick={() => { setView(item.id); setPage(1); }}>
            {item.label}
          </Button>
        ))}
      </div>
      {!list.data ? (
        <Skeleton height={240} />
      ) : list.data.items.length === 0 ? (
        <EmptyState icon="shield" title={view === 'flagged' ? 'Nothing flagged' : 'No listings'}>
          {view === 'flagged' ? `Listings land here after ${MARKET_REPORT_FLAG_THRESHOLD} separate reports.` : 'Try another view.'}
        </EmptyState>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th />
                  <th>Listing</th>
                  <th>Status</th>
                  <th>Reports</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((listing) => (
                  <Row key={listing.id} listing={listing} onChanged={refresh} />
                ))}
              </tbody>
            </table>
          </div>
          {list.data.totalPages > 1 ? (
            <div className={styles.pager}>
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className={styles.dim}>
                Page {page} of {list.data.totalPages}
              </span>
              <Button size="sm" variant="outline" disabled={page >= list.data.totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}
    </Panel>
  );
}
