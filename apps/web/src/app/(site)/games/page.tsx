import type { Metadata } from 'next';
import Link from 'next/link';
import { GAME_SORTS, GENRES, gameListQuerySchema, PLATFORMS, type GameSummary, type Page } from '@tgh/shared';
import { PageHeader } from '@/components/layout/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, Pagination } from '@/components/ui/primitives';
import { GameGrid } from '@/features/games/GameCover';
import { SortSelect } from '@/features/games/SortSelect';
import { getFormat, getT } from '@/i18n/server';
import { serverApi } from '@/lib/api/server';
import { cx } from '@/lib/cx';
import { hrefWith, parseParams } from '@/lib/search-params';
import styles from './games.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.nav.games };
}

const PAGE_SIZE = 20;

export default async function GamesPage(props: PageProps<'/games'>) {
  const [t, format] = await Promise.all([getT(), getFormat()]);
  const query = parseParams(gameListQuerySchema, await props.searchParams);
  const data = await serverApi<Page<GameSummary>>('/games', { query: { ...query, pageSize: PAGE_SIZE } });

  const current = {
    q: query.q,
    genre: query.genre,
    platform: query.platform,
    free: query.free,
    sort: query.sort === 'popular' ? undefined : query.sort,
    page: query.page,
  };
  const link = (changes: Record<string, string | boolean | number | undefined | null>) => hrefWith('/games', current, changes);
  const activeFilters = [query.genre, query.platform, query.free, query.q].filter((v) => v !== undefined).length;

  return (
    <>
      <PageHeader code={t.games.code} title={t.nav.games} lede={t.games.lede} />
      <div className={`container page ${styles.layout}`}>
        <aside className={styles.filters} aria-label={t.games.filters}>
          <div className={styles.filterGroup}>
            <p className={styles.filterTitle}>{t.games.platform}</p>
            <ul>
              <li>
                <Link href={link({ platform: null })} className={cx(styles.filter, !query.platform && styles.on)}>
                  {t.games.allPlatforms}
                </Link>
              </li>
              {PLATFORMS.map((platform) => (
                <li key={platform}>
                  <Link href={link({ platform })} className={cx(styles.filter, query.platform === platform && styles.on)}>
                    {t.labels.platform[platform]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.filterGroup}>
            <p className={styles.filterTitle}>{t.games.genre}</p>
            <ul>
              <li>
                <Link href={link({ genre: null })} className={cx(styles.filter, !query.genre && styles.on)}>
                  {t.games.allGenres}
                </Link>
              </li>
              {GENRES.map((genre) => (
                <li key={genre}>
                  <Link href={link({ genre })} className={cx(styles.filter, query.genre === genre && styles.on)}>
                    {t.labels.genre[genre]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.filterGroup}>
            <p className={styles.filterTitle}>{t.games.price}</p>
            <ul>
              <li>
                <Link href={link({ free: null })} className={cx(styles.filter, query.free === undefined && styles.on)}>
                  {t.games.anyPrice}
                </Link>
              </li>
              <li>
                <Link href={link({ free: true })} className={cx(styles.filter, query.free === true && styles.on)}>
                  {t.games.freeToPlay}
                </Link>
              </li>
              <li>
                <Link href={link({ free: false })} className={cx(styles.filter, query.free === false && styles.on)}>
                  {t.games.paid}
                </Link>
              </li>
            </ul>
          </div>
        </aside>

        <div className={styles.results}>
          <div className={styles.toolbar}>
            <form action="/games" className={styles.search} role="search">
              <Icon name="search" size={18} />
              <input name="q" defaultValue={query.q ?? ''} placeholder={t.games.search} aria-label={t.games.searchLabel} />
              {query.genre ? <input type="hidden" name="genre" value={query.genre} /> : null}
              {query.platform ? <input type="hidden" name="platform" value={query.platform} /> : null}
              {query.free !== undefined ? <input type="hidden" name="free" value={String(query.free)} /> : null}
            </form>
            <SortSelect
              label={t.market.sort}
              value={query.sort}
              options={GAME_SORTS.map((sort) => ({ value: sort, label: t.games.sort[sort], href: link({ sort: sort === 'popular' ? null : sort }) }))}
            />
          </div>

          <p className={styles.count}>
            <strong>{format.number(data.total)}</strong> {format.fill(t.games.count, { count: data.total })}
            {activeFilters > 0 ? (
              <Link href="/games" className={styles.clear}>
                {t.games.clearFilters} <Icon name="close" size={12} />
              </Link>
            ) : null}
          </p>

          {data.items.length > 0 ? (
            <GameGrid games={data.items} columns="auto" />
          ) : (
            <EmptyState icon="gamepad" title={t.games.noMatch}>
              {t.games.noMatchText}
            </EmptyState>
          )}

          <Pagination page={data.page} totalPages={data.totalPages} hrefFor={(page) => link({ page })} />
        </div>
      </div>
    </>
  );
}
