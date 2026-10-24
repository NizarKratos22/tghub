import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FIVEM_FRAMEWORK_LABELS,
  MARKET_CATEGORY_META,
  MARKET_CONDITION_LABELS,
  MARKET_SORTS,
  MARKET_SUBCATEGORIES,
  MARKET_SUBCATEGORY_LABELS,
  marketListQuerySchema,
  type ListingCard,
  type MarketCategoryCount,
  type MarketSort,
  type Page,
} from '@tgh/shared';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, Pagination } from '@/components/ui/primitives';
import { SortSelect } from '@/features/games/SortSelect';
import { ListingGrid } from '@/features/market/ListingCard';
import { MarketSidebar } from '@/features/market/MarketSidebar';
import { SaveSearchButton } from '@/features/market/SavedSearches';
import { fill } from '@/i18n/config';
import { getT } from '@/i18n/server';
import { serverApi, serverApiOr } from '@/lib/api/server';
import { cx } from '@/lib/cx';
import { formatNumber } from '@/lib/format';
import { hrefWith, parseParams } from '@/lib/search-params';
import styles from './market.module.css';

export const metadata: Metadata = {
  title: 'Marketplace',
  description: 'Buy and sell gaming PCs, parts, consoles and FiveM assets with players across Tunisia.',
};

export default async function MarketPage(props: PageProps<'/market'>) {
  const t = await getT();
  const SORT_LABELS: Record<MarketSort, string> = { newest: t.market.sortNewest, 'price-asc': t.market.sortPriceAsc, 'price-desc': t.market.sortPriceDesc };
  const query = parseParams(marketListQuerySchema, await props.searchParams);
  // The paid row shows on the first page of browsing, not inside searches.
  const showFeatured = query.page === 1 && !query.q && !query.seller;
  const [data, counts, featured] = await Promise.all([
    serverApi<Page<ListingCard>>('/market/listings', { query: { ...query } }),
    serverApiOr<MarketCategoryCount[]>('/market/categories', [], { revalidate: 60 }),
    showFeatured ? serverApiOr<ListingCard[]>('/market/featured', [], { query: { category: query.category } }) : Promise.resolve([]),
  ]);

  const current = {
    q: query.q,
    category: query.category,
    sub: query.sub,
    region: query.region,
    condition: query.condition,
    framework: query.framework,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    shipping: query.shipping,
    sort: query.sort === 'newest' ? undefined : query.sort,
    page: query.page,
  };
  const link = (changes: Record<string, string | number | boolean | undefined | null>) => hrefWith('/market', current, changes);
  // What "Save search" remembers: the filters, not the page or sort.
  const { sort: _sort, page: _page, ...criteria } = current;
  const criteriaSet = Object.values(criteria).some((value) => value !== undefined);

  const heading = query.q ? fill(t.market.resultsFor, { q: query.q }) : query.category ? t.market.categoryNames[query.category] : t.market.todaysPicks;
  const chips = [
    query.region ? { label: query.region, clear: { region: null } } : null,
    query.condition ? { label: MARKET_CONDITION_LABELS[query.condition], clear: { condition: null } } : null,
    query.framework ? { label: FIVEM_FRAMEWORK_LABELS[query.framework], clear: { framework: null } } : null,
    query.minPrice !== undefined ? { label: `From ${formatNumber(query.minPrice)} TND`, clear: { minPrice: null } } : null,
    query.maxPrice !== undefined ? { label: `Up to ${formatNumber(query.maxPrice)} TND`, clear: { maxPrice: null } } : null,
    query.shipping ? { label: 'Delivery available', clear: { shipping: null } } : null,
    query.q ? { label: `“${query.q}”`, clear: { q: null } } : null,
  ].filter((chip) => chip !== null);

  return (
    <div className={styles.shell}>
      <MarketSidebar query={query} counts={counts} link={link} />

      <section className={styles.main} aria-labelledby="market-heading">
        <div className={styles.top}>
          <div className={styles.heading}>
            <h2 id="market-heading">{heading}</h2>
            <p className={styles.meta}>
              <strong>{data.total === 1 ? t.market.listingCountOne : fill(t.market.listingCount, { count: formatNumber(data.total) })}</strong>
              {query.category ? ` · ${MARKET_CATEGORY_META[query.category].description}` : ` ${t.market.acrossTunisia}`}
            </p>
          </div>
          <div className={styles.topTools}>
            {criteriaSet ? <SaveSearchButton criteria={criteria} /> : null}
            <SortSelect label={t.market.sort} value={query.sort} options={MARKET_SORTS.map((sort) => ({ value: sort, label: SORT_LABELS[sort], href: link({ sort: sort === 'newest' ? null : sort }) }))} />
          </div>
        </div>

        {query.category && MARKET_SUBCATEGORIES[query.category].length > 0 ? (
          <nav className={styles.subs} aria-label="Types">
            <Link href={link({ sub: null })} className={cx(styles.sub, !query.sub && styles.subOn)} scroll={false}>
              {t.common.all}
            </Link>
            {MARKET_SUBCATEGORIES[query.category].map((sub) => (
              <Link key={sub} href={link({ sub })} className={cx(styles.sub, query.sub === sub && styles.subOn)} scroll={false}>
                {MARKET_SUBCATEGORY_LABELS[sub]}
              </Link>
            ))}
          </nav>
        ) : null}

        {chips.length > 0 ? (
          <div className={styles.chips}>
            {chips.map((chip) => (
              <Link key={chip.label} href={link(chip.clear)} className={styles.chip} aria-label={`Remove filter ${chip.label}`}>
                {chip.label} <Icon name="close" size={12} />
              </Link>
            ))}
          </div>
        ) : null}

        {query.category === 'fivem' ? (
          <p className={styles.notice}>
            <Icon name="shield" size={18} />
            <span>
              <strong>Buying FiveM assets?</strong> Prefer Keymaster transfers or Tebex for escrowed resources, ask for a preview video, and report
              leaked or resold work — sellers confirm they own the rights to every digital listing.
            </span>
          </p>
        ) : null}

        {featured.length > 0 ? (
          <section className={styles.featuredRow} aria-labelledby="featured-heading">
            <h3 id="featured-heading">
              <Icon name="bolt" size={16} /> {t.market.featured}
            </h3>
            <ListingGrid listings={featured} dense />
          </section>
        ) : null}

        {data.items.length > 0 ? (
          <ListingGrid listings={data.items} />
        ) : (
          <EmptyState icon="store" title={t.market.nothingHere} action={<ButtonLink href="/market/sell" icon="plus">{t.market.sellSomething}</ButtonLink>}>
            {chips.length > 0 ? t.market.tryRemoving : t.market.beFirst}
          </EmptyState>
        )}

        <Pagination page={data.page} totalPages={data.totalPages} hrefFor={(page) => link({ page })} />
      </section>
    </div>
  );
}
