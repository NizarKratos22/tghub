import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ASSET_DELIVERY_LABELS,
  ASSET_SOURCE_LABELS,
  FIVEM_FRAMEWORK_LABELS,
  LISTING_STATUS_LABELS,
  MARKET_CATEGORY_META,
  MARKET_CONDITION_LABELS,
  MARKET_SUBCATEGORY_LABELS,
  type ListingCard,
  type ListingDetail,
  type Page,
} from '@tgh/shared';
import { Icon } from '@/components/ui/Icon';
import { Avatar, Tag } from '@/components/ui/primitives';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { RelativeTime } from '@/components/ui/time';
import { Gallery } from '@/features/market/Gallery';
import { ListingActions } from '@/features/market/ListingActions';
import { ListingGrid } from '@/features/market/ListingCard';
import { ReputationLine } from '@/features/market/reputation';
import { serverApi, serverApiOr } from '@/lib/api/server';
import { formatDateYear, formatTnd } from '@/lib/format';
import styles from './listing.module.css';

export async function generateMetadata(props: PageProps<'/market/item/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  if (!/^[a-f\d]{24}$/i.test(id)) return { title: 'Listing not found' };
  const listing = await serverApiOr<ListingDetail | null>(`/market/listings/${id}`, null);
  return listing
    ? { title: `${listing.title} — ${formatTnd(listing.price)}`, description: listing.description.slice(0, 160) }
    : { title: 'Listing not found' };
}

export default async function ListingPage(props: PageProps<'/market/item/[id]'>) {
  const { id } = await props.params;
  if (!/^[a-f\d]{24}$/i.test(id)) notFound();
  const listing = await serverApi<ListingDetail>(`/market/listings/${id}`);
  const [fromSeller, similar] = await Promise.all([
    serverApiOr<Page<ListingCard> | null>('/market/listings', null, { query: { seller: listing.seller.username, pageSize: 7 } }),
    serverApiOr<Page<ListingCard> | null>('/market/listings', null, {
      query: { category: listing.category, sub: listing.subcategory ?? undefined, pageSize: 7 },
    }),
  ]);
  const others = (page: Page<ListingCard> | null) => (page?.items ?? []).filter((item) => item.id !== listing.id).slice(0, 6);
  const sellerOthers = others(fromSeller);
  const similarOthers = others(similar).filter((item) => !sellerOthers.some((own) => own.id === item.id));

  const digital = listing.digitalInfo;
  const details: Array<[string, string]> = [
    ['Category', listing.subcategory ? `${MARKET_CATEGORY_META[listing.category].label} › ${MARKET_SUBCATEGORY_LABELS[listing.subcategory]}` : MARKET_CATEGORY_META[listing.category].label],
    ...(listing.condition ? [['Condition', MARKET_CONDITION_LABELS[listing.condition]] as [string, string]] : []),
    ...(digital?.framework ? [['Framework', FIVEM_FRAMEWORK_LABELS[digital.framework]] as [string, string]] : []),
    ...(digital ? [['Delivery', ASSET_DELIVERY_LABELS[digital.delivery]] as [string, string], ['Source', ASSET_SOURCE_LABELS[digital.source]] as [string, string]] : []),
    ...(!digital
      ? [['Hand-over', [listing.meetup ? 'Meet-up' : null, listing.shipping ? 'Delivery' : null].filter(Boolean).join(' or ')] as [string, string]]
      : []),
  ];

  return (
    <div className="container page">
      <nav className={styles.crumbs} aria-label="Breadcrumb">
        <Link href="/market">Marketplace</Link>
        <Icon name="chevronRight" size={12} />
        <Link href={`/market?category=${listing.category}`}>{MARKET_CATEGORY_META[listing.category].label}</Link>
        {listing.subcategory ? (
          <>
            <Icon name="chevronRight" size={12} />
            <Link href={`/market?category=${listing.category}&sub=${listing.subcategory}`}>{MARKET_SUBCATEGORY_LABELS[listing.subcategory]}</Link>
          </>
        ) : null}
      </nav>

      <div className={styles.layout}>
        <Gallery photos={listing.photos} title={listing.title} />

        <div className={styles.info}>
          <header className={styles.head}>
            <div className={styles.tags}>
              {listing.status !== 'active' ? <Tag tone={listing.status === 'sold' ? 'solid' : 'gold'}>{LISTING_STATUS_LABELS[listing.status]}</Tag> : null}
              {listing.digital ? <Tag tone="purple">Digital asset</Tag> : null}
              {listing.negotiable ? <Tag tone="primary">Negotiable</Tag> : null}
              {listing.openToTrades ? <Tag tone="success">Open to trades</Tag> : null}
            </div>
            <h1 className={styles.title}>{listing.title}</h1>
            <p className={styles.price}>{formatTnd(listing.price)}</p>
            <p className={styles.listed}>
              Listed <RelativeTime iso={listing.bumpedAt} />
              {listing.region ? (
                <>
                  {' '}
                  in <strong>{listing.region}</strong>
                </>
              ) : null}
            </p>
          </header>

          <ListingActions listing={listing} />

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Details</h2>
            <dl className={styles.details}>
              {details.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className={styles.description}>{listing.description}</p>
            {listing.region ? (
              <p className={styles.location}>
                <Icon name="mapPin" size={16} />
                {[listing.area, listing.region].filter(Boolean).join(', ')}
              </p>
            ) : null}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Seller</h2>
            <Link href={`/u/${listing.seller.username}`} className={styles.seller}>
              <Avatar name={listing.seller.displayName} color={listing.seller.avatarColor} src={listing.seller.avatarUrl} size={48} />
              <span className={styles.sellerText}>
                <span className={styles.sellerName}>{listing.seller.displayName}</span>
                <span className={styles.sellerMeta}>
                  Joined {formatDateYear(listing.seller.joinedAt)} · Level {listing.seller.level}
                  {listing.seller.region ? ` · ${listing.seller.region}` : ''}
                </span>
              </span>
              <Icon name="chevronRight" size={18} />
            </Link>
            <p className={styles.sellerReputation}>
              <ReputationLine reputation={listing.seller.reputation} />
            </p>
            <div className={styles.sellerStats}>
              <span>
                <strong>{listing.seller.activeListings}</strong> for sale
              </span>
              <span>
                <strong>{listing.seller.soldListings}</strong> sold
              </span>
              <Link href={`/market?seller=${encodeURIComponent(listing.seller.username)}`}>See all listings</Link>
            </div>
            <p className={styles.safety}>
              <Icon name="shield" size={16} />
              Meet in a public place, check the item before paying, and never send money for an item you haven&apos;t seen. TG Hub doesn&apos;t handle
              payments.
            </p>
          </section>
        </div>
      </div>

      {sellerOthers.length > 0 ? (
        <section className={styles.more}>
          <SectionHeader title={`More from ${listing.seller.displayName}`} action={{ href: `/market?seller=${encodeURIComponent(listing.seller.username)}`, label: 'See all' }} />
          <ListingGrid listings={sellerOthers} dense />
        </section>
      ) : null}

      {similarOthers.length > 0 ? (
        <section className={styles.more}>
          <SectionHeader
            title="Similar listings"
            action={{ href: `/market?category=${listing.category}${listing.subcategory ? `&sub=${listing.subcategory}` : ''}`, label: 'Browse category' }}
          />
          <ListingGrid listings={similarOthers} dense />
        </section>
      ) : null}
    </div>
  );
}
