import Link from 'next/link';
import {
  FIVEM_FRAMEWORKS,
  isDigitalCategory,
  MARKET_CATEGORIES,
  MARKET_CONDITIONS,
  TN_REGIONS,
  type MarketCategoryCount,
  type MarketListQuery,
} from '@tgh/shared';
import { ButtonLink } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { regionName } from '@/i18n/places';
import { getFormat, getT } from '@/i18n/server';
import { cx } from '@/lib/cx';
import { CATEGORY_ICONS } from './meta';
import styles from './MarketSidebar.module.css';

export type MarketLink = (changes: Record<string, string | number | boolean | undefined | null>) => string;

const ACCOUNT_LINKS: Array<{ href: string; label: 'browseAll' | 'inbox' | 'saved' | 'savedSearches' | 'yourListings'; icon: IconName }> = [
  { href: '/market', label: 'browseAll', icon: 'store' },
  { href: '/market/inbox', label: 'inbox', icon: 'message' },
  { href: '/market/saved', label: 'saved', icon: 'heart' },
  { href: '/market/searches', label: 'savedSearches', icon: 'bell' },
  { href: '/market/selling', label: 'yourListings', icon: 'tag' },
];

/** Shared by every marketplace page: where you are, what you can do, and (on browse) the filters. */
export async function MarketNav({ active }: { active: string }) {
  const t = await getT();
  return (
    <nav className={styles.nav} aria-label={t.nav.market}>
      {ACCOUNT_LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={cx(styles.navLink, active === link.href && styles.navOn)}>
          <span className={styles.navIcon}>
            <Icon name={link.icon} size={18} />
          </span>
          {t.market[link.label]}
        </Link>
      ))}
    </nav>
  );
}

export async function MarketSidebar({
  query,
  counts,
  link,
  active = '/market',
  collapseOnMobile = false,
}: {
  query?: MarketListQuery;
  counts?: MarketCategoryCount[];
  link?: MarketLink;
  active?: string;
  /** Inbox and forms need the whole phone screen; the nav row stays reachable from the header. */
  collapseOnMobile?: boolean;
}) {
  const [t, format] = await Promise.all([getT(), getFormat()]);
  const countFor = new Map(counts?.map((row) => [row.category, row.count]));
  const total = counts?.reduce((sum, row) => sum + row.count, 0) ?? 0;
  const digital = query?.category ? isDigitalCategory(query.category) : false;
  const filtering = Boolean(query && (query.region || query.minPrice !== undefined || query.maxPrice !== undefined || query.condition || query.framework || query.shipping));

  return (
    <aside className={cx(styles.sidebar, collapseOnMobile && styles.collapse)}>
      <div className={styles.head}>
        <h1 className={styles.title}>{t.nav.market}</h1>
        <form action="/market" className={styles.search} role="search">
          <Icon name="search" size={17} />
          <input name="q" defaultValue={query?.q ?? ''} placeholder={t.market.searchPlaceholder} aria-label={t.market.searchPlaceholder} />
          {query?.category ? <input type="hidden" name="category" value={query.category} /> : null}
        </form>
      </div>

      <MarketNav active={active} />

      <ButtonLink href="/market/sell" icon="plus" block className={styles.sell}>
        {t.market.createListing}
      </ButtonLink>

      {query && link ? (
        <>
          <details className={styles.filters} open={filtering}>
            <summary>
              <Icon name="filter" size={16} /> {t.market.filters}
            </summary>
            <form action="/market" className={styles.filterForm}>
              {query.q ? <input type="hidden" name="q" value={query.q} /> : null}
              {query.category ? <input type="hidden" name="category" value={query.category} /> : null}
              {query.sub ? <input type="hidden" name="sub" value={query.sub} /> : null}
              {query.sort !== 'newest' ? <input type="hidden" name="sort" value={query.sort} /> : null}

              {!digital ? (
                <label className={styles.field}>
                  <span>{t.market.location}</span>
                  <select name="region" defaultValue={query.region ?? ''}>
                    <option value="">{t.market.allTunisia}</option>
                    {TN_REGIONS.filter((region) => region !== 'Abroad').map((region) => (
                      <option key={region} value={region}>
                        {regionName(region, t)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className={styles.field}>
                <span>{t.market.price}</span>
                <div className={styles.priceRow}>
                  <input name="minPrice" type="number" min={0} inputMode="numeric" placeholder={t.market.min} defaultValue={query.minPrice ?? ''} aria-label={t.market.min} />
                  <span aria-hidden>–</span>
                  <input name="maxPrice" type="number" min={0} inputMode="numeric" placeholder={t.market.max} defaultValue={query.maxPrice ?? ''} aria-label={t.market.max} />
                </div>
              </div>

              {query.category === 'fivem' ? (
                <label className={styles.field}>
                  <span>{t.market.framework}</span>
                  <select name="framework" defaultValue={query.framework ?? ''}>
                    <option value="">{t.market.anyFramework}</option>
                    {FIVEM_FRAMEWORKS.map((framework) => (
                      <option key={framework} value={framework}>
                        {t.labels.framework[framework]}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {!digital ? (
                <>
                  <label className={styles.field}>
                    <span>{t.market.condition}</span>
                    <select name="condition" defaultValue={query.condition ?? ''}>
                      <option value="">{t.market.anyCondition}</option>
                      {MARKET_CONDITIONS.map((condition) => (
                        <option key={condition} value={condition}>
                          {t.labels.condition[condition]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.check}>
                    <input type="checkbox" name="shipping" value="true" defaultChecked={query.shipping === true} />
                    {t.market.deliveryAvailable}
                  </label>
                </>
              ) : null}

              <div className={styles.filterActions}>
                <button type="submit" className={styles.apply}>
                  {t.market.apply}
                </button>
                <Link href={link({ region: null, minPrice: null, maxPrice: null, condition: null, framework: null, shipping: null })} className={styles.reset}>
                  {t.market.reset}
                </Link>
              </div>
            </form>
          </details>

          <div className={styles.categories}>
            <p className={styles.sectionTitle}>{t.market.categories}</p>
            <ul>
              <li>
                <Link href={link({ category: null, sub: null, framework: null })} className={cx(styles.category, !query.category && styles.categoryOn)}>
                  <span className={styles.categoryIcon}>
                    <Icon name="grid" size={18} />
                  </span>
                  <span className={styles.categoryText}>{t.market.allCategories}</span>
                  {total > 0 ? <span className={styles.count}>{format.number(total)}</span> : null}
                </Link>
              </li>
              {MARKET_CATEGORIES.map((category) => (
                <li key={category}>
                  <Link
                    href={link({ category, sub: null, framework: null, condition: null })}
                    className={cx(styles.category, query.category === category && styles.categoryOn, category === 'fivem' && styles.highlight)}
                  >
                    <span className={styles.categoryIcon}>
                      <Icon name={CATEGORY_ICONS[category]} size={18} />
                    </span>
                    <span className={styles.categoryText}>{t.market.categoryNames[category]}</span>
                    {countFor.get(category) ? <span className={styles.count}>{format.number(countFor.get(category)!)}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </aside>
  );
}
