import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ListingCard, ListingDetail, Page } from '@tgh/shared';
import { Icon } from '@/components/ui/Icon';
import { Avatar, Tag } from '@/components/ui/primitives';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { RelativeTime } from '@/components/ui/time';
import { Gallery } from '@/features/market/Gallery';
import { ListingActions } from '@/features/market/ListingActions';
import { ListingGrid } from '@/features/market/ListingCard';
import { ReputationLine } from '@/features/market/reputation';
import { fill } from '@/i18n/config';
import { regionName } from '@/i18n/places';
import { getFormat, getT } from '@/i18n/server';
import { serverApi, serverApiOr } from '@/lib/api/server';
import styles from './listing.module.css';

export async function generateMetadata(props: PageProps<'/market/item/[id]'>): Promise<Metadata> {
  const { id } = await props.params;
  const [t, format] = await Promise.all([getT(), getFormat()]);
  if (!/^[a-f\d]{24}$/i.test(id)) return { title: t.listing.notFound };
  const listing = await serverApiOr<ListingDetail | null>(`/market/listings/${id}`, null);
  return listing
    ? { title: `${listing.title} — ${format.tnd(listing.price)}`, description: listing.description.slice(0, 160) }
    : { title: t.listing.notFound };
}

export default async function ListingPage(props: PageProps<'/market/item/[id]'>) {
  const { id } = await props.params;
  if (!/^[a-f\d]{24}$/i.test(id)) notFound();
  const [t, format] = await Promise.all([getT(), getFormat()]);
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
  const categoryName = t.market.categoryNames[listing.category];
  const handOver = listing.meetup && listing.shipping ? t.listing.meetupOrShipping : listing.meetup ? t.listing.meetup : t.listing.shipping;
  const details: Array<[string, string]> = [
    [t.listing.category, listing.subcategory ? `${categoryName} › ${t.labels.subcategory[listing.subcategory]}` : categoryName],
    ...(listing.condition ? [[t.listing.condition, t.labels.condition[listing.condition]] as [string, string]] : []),
    ...(digital?.framework ? [[t.listing.framework, t.labels.framework[digital.framework]] as [string, string]] : []),
    ...(digital ? [[t.listing.delivery, t.labels.delivery[digital.delivery]] as [string, string], [t.listing.source, t.labels.source[digital.source]] as [string, string]] : []),
    ...(!digital ? [[t.listing.handOver, handOver] as [string, string]] : []),
  ];

  return (
    <div className="container page">
      <nav className={styles.crumbs} aria-label={t.listing.breadcrumb}>
        <Link href="/market">{t.nav.market}</Link>
        <Icon name="chevronRight" size={12} />
        <Link href={`/market?category=${listing.category}`}>{categoryName}</Link>
        {listing.subcategory ? (
          <>
            <Icon name="chevronRight" size={12} />
            <Link href={`/market?category=${listing.category}&sub=${listing.subcategory}`}>{t.labels.subcategory[listing.subcategory]}</Link>
          </>
        ) : null}
      </nav>

      <div className={styles.layout}>
        <Gallery photos={listing.photos} title={listing.title} />

        <div className={styles.info}>
          <header className={styles.head}>
            <div className={styles.tags}>
              {listing.status !== 'active' ? <Tag tone={listing.status === 'sold' ? 'solid' : 'gold'}>{t.labels.listingStatus[listing.status]}</Tag> : null}
              {listing.digital ? <Tag tone="purple">{t.listing.digitalAsset}</Tag> : null}
              {listing.negotiable ? <Tag tone="primary">{t.listing.negotiable}</Tag> : null}
              {listing.openToTrades ? <Tag tone="success">{t.listing.openToTrades}</Tag> : null}
            </div>
            <h1 className={styles.title}>
              <bdi>{listing.title}</bdi>
            </h1>
            <p className={styles.price}>{format.tnd(listing.price)}</p>
            <p className={styles.listed}>
              {t.listing.listed} <RelativeTime iso={listing.bumpedAt} />
              {listing.region ? (
                <>
                  {' '}
                  {t.listing.listedIn} <strong>{regionName(listing.region, t)}</strong>
                </>
              ) : null}
            </p>
          </header>

          <ListingActions listing={listing} />

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t.listing.details}</h2>
            <dl className={styles.details}>
              {details.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className={styles.description} dir="auto">{listing.description}</p>
            {listing.region ? (
              <p className={styles.location}>
                <Icon name="mapPin" size={16} />
                {listing.area ? fill(t.labels.place, { region: listing.area, country: regionName(listing.region, t) }) : regionName(listing.region, t)}
              </p>
            ) : null}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t.listing.seller}</h2>
            <Link href={`/u/${listing.seller.username}`} className={styles.seller}>
              <Avatar name={listing.seller.displayName} color={listing.seller.avatarColor} src={listing.seller.avatarUrl} size={48} />
              <span className={styles.sellerText}>
                <span className={styles.sellerName}>{listing.seller.displayName}</span>
                <span className={styles.sellerMeta}>
                  {fill(t.listing.joined, { date: format.dateYear(listing.seller.joinedAt) })} · {fill(t.common.level, { level: listing.seller.level })}
                  {listing.seller.region ? ` · ${regionName(listing.seller.region, t)}` : ''}
                </span>
              </span>
              <Icon name="chevronRight" size={18} />
            </Link>
            <p className={styles.sellerReputation}>
              <ReputationLine reputation={listing.seller.reputation} />
            </p>
            <div className={styles.sellerStats}>
              <span>
                <strong>{format.number(listing.seller.activeListings)}</strong> {t.listing.forSale}
              </span>
              <span>
                <strong>{format.number(listing.seller.soldListings)}</strong> {t.listing.sold}
              </span>
              <Link href={`/market?seller=${encodeURIComponent(listing.seller.username)}`}>{t.listing.seeAllListings}</Link>
            </div>
            <p className={styles.safety}>
              <Icon name="shield" size={16} />
              {t.listing.safety}
            </p>
          </section>
        </div>
      </div>

      {sellerOthers.length > 0 ? (
        <section className={styles.more}>
          <SectionHeader
            title={fill(t.listing.moreFrom, { name: listing.seller.displayName })}
            action={{ href: `/market?seller=${encodeURIComponent(listing.seller.username)}`, label: t.common.seeAll }}
          />
          <ListingGrid listings={sellerOthers} dense />
        </section>
      ) : null}

      {similarOthers.length > 0 ? (
        <section className={styles.more}>
          <SectionHeader
            title={t.listing.similar}
            action={{ href: `/market?category=${listing.category}${listing.subcategory ? `&sub=${listing.subcategory}` : ''}`, label: t.listing.browseCategory }}
          />
          <ListingGrid listings={similarOthers} dense />
        </section>
      ) : null}
    </div>
  );
}
