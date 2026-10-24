'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { ADMIN_STATS_RANGES, homeLabel, LISTING_STATUS_LABELS, MARKET_CATEGORY_META, type AdminStats, type AdminStatsMetric } from '@tgh/shared';
import { Icon, type IconName } from '@/components/ui/Icon';
import { EmptyState, Skeleton, Tag } from '@/components/ui/primitives';
import { RelativeTime } from '@/components/ui/time';
import { api } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { formatTnd } from '@/lib/format';
import { OVERVIEW_KEY } from './AdminShell';
import { BarList, ColumnChart, formatCompact, formatDay, formatFull, Legend, LineChart, Sparkline, type LineSeries } from './charts';
import styles from './AdminOverview.module.css';

type Range = (typeof ADMIN_STATS_RANGES)[number];

const KPIS: Array<{ metric: AdminStatsMetric; label: string; icon: IconName; upIsGood: boolean }> = [
  { metric: 'signups', label: 'New players', icon: 'users', upIsGood: true },
  { metric: 'listings', label: 'New listings', icon: 'tag', upIsGood: true },
  { metric: 'messages', label: 'Marketplace messages', icon: 'message', upIsGood: true },
  { metric: 'xp', label: 'XP earned', icon: 'star', upIsGood: true },
  { metric: 'reports', label: 'Listing reports', icon: 'flag', upIsGood: false },
];

const ACTIVITY: Array<{ metric: AdminStatsMetric; label: string; color: string }> = [
  { metric: 'signups', label: 'New players', color: 'var(--series-1)' },
  { metric: 'listings', label: 'New listings', color: 'var(--series-2)' },
  { metric: 'messages', label: 'Messages', color: 'var(--series-3)' },
];

function Delta({ current, previous, upIsGood, days }: { current: number; previous: number; upIsGood: boolean; days: number }) {
  const label = `vs previous ${days} days`;
  if (previous === 0 && current === 0) return <span className={styles.delta}>No change {label}</span>;
  if (previous === 0) return <span className={cx(styles.delta, upIsGood ? styles.good : styles.bad)}>New this period</span>;
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return <span className={styles.delta}>Flat {label}</span>;
  const good = change > 0 === upIsGood;
  return (
    <span className={cx(styles.delta, good ? styles.good : styles.bad)}>
      {change > 0 ? '+' : '−'}
      {Math.abs(change)}% <span className={styles.deltaNote}>{label}</span>
    </span>
  );
}

function Card({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx(styles.card, className)}>
      <header className={styles.cardHead}>
        <div>
          <h2 className={styles.cardTitle}>{title}</h2>
          {subtitle ? <p className={styles.cardSub}>{subtitle}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function ActivityTable({ stats }: { stats: AdminStats }) {
  const rows = [...stats.series].reverse();
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Day</th>
            {ACTIVITY.map((item) => (
              <th key={item.metric} scope="col" className={styles.num}>
                {item.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((point) => (
            <tr key={point.day}>
              <td>{formatDay(point.day)}</td>
              {ACTIVITY.map((item) => (
                <td key={item.metric} className={styles.num}>
                  {formatFull(point[item.metric])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminOverview() {
  const [range, setRange] = useState<Range>(30);
  const [asTable, setAsTable] = useState(false);
  const overview = useQuery({ queryKey: OVERVIEW_KEY, queryFn: api.admin.overview, refetchInterval: 60_000 });
  // Keep the last render on screen while a new range loads — no flash, no layout jump.
  const stats = useQuery({ queryKey: ['admin', 'stats', range], queryFn: () => api.admin.stats(range), placeholderData: keepPreviousData });

  const o = overview.data;
  const s = stats.data;
  const days = s?.series.map((point) => point.day) ?? [];
  const activity: LineSeries[] = s ? ACTIVITY.map((item) => ({ key: item.metric, label: item.label, color: item.color, values: s.series.map((point) => point[item.metric]) })) : [];
  const attention = o
    ? [
        o.flaggedListings > 0 ? { href: '/admin/marketplace', icon: 'flag' as const, text: `${o.flaggedListings} flagged ${o.flaggedListings === 1 ? 'listing' : 'listings'} to review`, tone: 'danger' } : null,
        o.failingSources > 0 ? { href: '/admin/sources', icon: 'alert' as const, text: `${o.failingSources} alert ${o.failingSources === 1 ? 'source needs' : 'sources need'} attention`, tone: 'warning' } : null,
      ].filter((item) => item !== null)
    : [];

  return (
    <div className={styles.dashboard}>
      <div className={styles.filters}>
        <div className={styles.ranges} role="radiogroup" aria-label="Date range">
          {ADMIN_STATS_RANGES.map((value) => (
            <button key={value} type="button" role="radio" aria-checked={range === value} className={cx(styles.range, range === value && styles.rangeOn)} onClick={() => setRange(value)}>
              Last {value} days
            </button>
          ))}
        </div>
        <p className={styles.filterNote}>Compared with the {range} days before · Tunis time</p>
      </div>

      {o ? (
        attention.length > 0 ? (
          <ul className={styles.attention}>
            {attention.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={cx(styles.attentionItem, item.tone === 'danger' ? styles.attentionDanger : styles.attentionWarning)}>
                  <Icon name={item.icon} size={17} />
                  {item.text}
                  <Icon name="chevronRight" size={16} className={styles.attentionGo} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className={cx(styles.attentionItem, styles.attentionClear)}>
            <Icon name="check" size={17} /> All clear — no flagged listings and every alert source is healthy.
          </p>
        )
      ) : null}

      <div className={cx(styles.body, stats.isFetching && s && styles.refreshing)}>
        {!s ? (
          <div className={styles.kpis}>
            {KPIS.map((kpi) => (
              <Skeleton key={kpi.metric} height={128} />
            ))}
          </div>
        ) : (
          <ul className={styles.kpis}>
            {KPIS.map((kpi) => (
              <li key={kpi.metric} className={styles.kpi}>
                <p className={styles.kpiLabel}>
                  <Icon name={kpi.icon} size={15} />
                  {kpi.label}
                </p>
                <p className={styles.kpiValue} title={formatFull(s.totals[kpi.metric])}>
                  {formatCompact(s.totals[kpi.metric])}
                </p>
                <Delta current={s.totals[kpi.metric]} previous={s.previous[kpi.metric]} upIsGood={kpi.upIsGood} days={s.days} />
                <Sparkline values={s.series.map((point) => point[kpi.metric])} label={`${kpi.label} per day`} />
              </li>
            ))}
          </ul>
        )}

        <div className={styles.grid}>
          <Card
            title="Community activity"
            subtitle="Sign-ups, new listings and marketplace messages per day."
            className={styles.wide}
            action={
              <button type="button" className={styles.toggle} onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
                <Icon name={asTable ? 'grid' : 'layout'} size={15} />
                {asTable ? 'Show chart' : 'Show table'}
              </button>
            }
          >
            {s ? (
              asTable ? (
                <ActivityTable stats={s} />
              ) : (
                <>
                  <Legend series={activity} />
                  <LineChart days={days} series={activity} label="Community activity per day" />
                </>
              )
            ) : (
              <Skeleton height={280} />
            )}
          </Card>

          <Card title="Active listings by category" subtitle="Listings buyers can see right now.">
            {s ? (
              s.listingsByCategory.length > 0 ? (
                <BarList
                  label="Active listings by category"
                  rows={s.listingsByCategory.map((row) => ({ key: row.category, label: MARKET_CATEGORY_META[row.category].label, value: row.count, href: `/market?category=${row.category}` }))}
                />
              ) : (
                <EmptyState icon="store" title="No listings yet" />
              )
            ) : (
              <Skeleton height={240} />
            )}
          </Card>

          <Card title="XP earned per day" subtitle="Missions, achievements and activity, from the XP ledger.">
            {s ? <ColumnChart days={days} values={s.series.map((point) => point.xp)} label="XP earned per day" unit="XP" /> : <Skeleton height={220} />}
          </Card>

          <Card title="Newest players" action={<Link href="/admin/users" className={styles.more}>All players</Link>}>
            {s ? (
              <ul className={styles.list}>
                {s.recentSignups.map((user) => (
                  <li key={user.id} className={styles.listRow}>
                    <span className={styles.listMain}>
                      <Link href={`/u/${user.username}`} className={styles.listTitle}>
                        {user.username}
                      </Link>
                      <span className={styles.listSub}>
                        {homeLabel(user) ?? 'No home set'} · Level {user.level}
                        {user.role !== 'user' ? ` · ${user.role}` : ''}
                      </span>
                    </span>
                    <RelativeTime iso={user.createdAt} className={styles.listTime} />
                  </li>
                ))}
              </ul>
            ) : (
              <Skeleton height={220} />
            )}
          </Card>

          <Card title="Newest listings" action={<Link href="/admin/marketplace" className={styles.more}>Moderation</Link>}>
            {s ? (
              <ul className={styles.list}>
                {s.recentListings.map((listing) => (
                  <li key={listing.id} className={styles.listRow}>
                    {listing.photo ? <img src={listing.photo.thumbUrl} alt="" width={40} height={40} className={styles.thumb} /> : <span className={styles.thumb} />}
                    <span className={styles.listMain}>
                      <Link href={`/market/item/${listing.id}`} className={styles.listTitle}>
                        {listing.title}
                      </Link>
                      <span className={styles.listSub}>
                        @{listing.seller.username} · {formatTnd(listing.price)}
                      </span>
                    </span>
                    {listing.flagged ? <Tag tone="danger">Flagged</Tag> : listing.status !== 'active' ? <Tag tone="muted">{LISTING_STATUS_LABELS[listing.status]}</Tag> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <Skeleton height={220} />
            )}
          </Card>
        </div>

        {o ? (
          <Card title="Platform totals" subtitle="Everything on TG Hub right now.">
            <dl className={styles.totals}>
              {(
                [
                  ['Players', o.users],
                  ['Games', o.games],
                  ['Radar items', o.resources],
                  ['Active listings', o.activeListings],
                  ['Upcoming tournaments', o.upcomingTournaments],
                  ['Alerts · 24 h', o.alerts24h],
                  ['Inbox deliveries · 24 h', o.notifications24h],
                ] as Array<[string, number]>
              ).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{formatFull(value)}</dd>
                </div>
              ))}
            </dl>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
