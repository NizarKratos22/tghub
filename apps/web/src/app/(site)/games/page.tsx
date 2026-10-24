import type { Metadata } from 'next';
import Link from 'next/link';
import { GAME_SORTS, GENRE_LABELS, GENRES, gameListQuerySchema, PLATFORM_LABELS, PLATFORMS, type GameSummary, type Page } from '@tgh/shared';
import { PageHeader } from '@/components/layout/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, Pagination } from '@/components/ui/primitives';
import { GameGrid } from '@/features/games/GameCover';
import { SortSelect } from '@/features/games/SortSelect';
import { serverApi } from '@/lib/api/server';
import { cx } from '@/lib/cx';
import { hrefWith, parseParams } from '@/lib/search-params';
import styles from './games.module.css';

export const metadata: Metadata = { title: 'Games' };

const PAGE_SIZE = 20;
const SORT_LABELS: Record<(typeof GAME_SORTS)[number], string> = { popular: 'Most popular', newest: 'Newest', title: 'A–Z' };

export default async function GamesPage(props: PageProps<'/games'>) {
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
      <PageHeader code="Catalogue" title="Games" lede="The games Tunisia plays — with published PC requirements, platforms and everything on the Radar for each one." />
      <div className={`container page ${styles.layout}`}>
        <aside className={styles.filters} aria-label="Filters">
          <div className={styles.filterGroup}>
            <p className={styles.filterTitle}>Platform</p>
            <ul>
              <li>
                <Link href={link({ platform: null })} className={cx(styles.filter, !query.platform && styles.on)}>
                  All platforms
                </Link>
              </li>
              {PLATFORMS.map((platform) => (
                <li key={platform}>
                  <Link href={link({ platform })} className={cx(styles.filter, query.platform === platform && styles.on)}>
                    {PLATFORM_LABELS[platform]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.filterGroup}>
            <p className={styles.filterTitle}>Genre</p>
            <ul>
              <li>
                <Link href={link({ genre: null })} className={cx(styles.filter, !query.genre && styles.on)}>
                  All genres
                </Link>
              </li>
              {GENRES.map((genre) => (
                <li key={genre}>
                  <Link href={link({ genre })} className={cx(styles.filter, query.genre === genre && styles.on)}>
                    {GENRE_LABELS[genre]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.filterGroup}>
            <p className={styles.filterTitle}>Price</p>
            <ul>
              <li>
                <Link href={link({ free: null })} className={cx(styles.filter, query.free === undefined && styles.on)}>
                  Any price
                </Link>
              </li>
              <li>
                <Link href={link({ free: true })} className={cx(styles.filter, query.free === true && styles.on)}>
                  Free-to-play
                </Link>
              </li>
              <li>
                <Link href={link({ free: false })} className={cx(styles.filter, query.free === false && styles.on)}>
                  Paid
                </Link>
              </li>
            </ul>
          </div>
        </aside>

        <div className={styles.results}>
          <div className={styles.toolbar}>
            <form action="/games" className={styles.search} role="search">
              <Icon name="search" size={18} />
              <input name="q" defaultValue={query.q ?? ''} placeholder="Search by title or nickname — cs2, lol, pes…" aria-label="Search games" />
              {query.genre ? <input type="hidden" name="genre" value={query.genre} /> : null}
              {query.platform ? <input type="hidden" name="platform" value={query.platform} /> : null}
              {query.free !== undefined ? <input type="hidden" name="free" value={String(query.free)} /> : null}
            </form>
            <SortSelect
              value={query.sort}
              options={GAME_SORTS.map((sort) => ({ value: sort, label: SORT_LABELS[sort], href: link({ sort: sort === 'popular' ? null : sort }) }))}
            />
          </div>

          <p className={styles.count}>
            <strong>{data.total}</strong> {data.total === 1 ? 'game' : 'games'}
            {activeFilters > 0 ? (
              <Link href="/games" className={styles.clear}>
                Clear filters <Icon name="close" size={12} />
              </Link>
            ) : null}
          </p>

          {data.items.length > 0 ? (
            <GameGrid games={data.items} columns={4} />
          ) : (
            <EmptyState icon="gamepad" title="No games match">
              Try a nickname (&quot;cs2&quot;, &quot;lol&quot;, &quot;pes&quot;) or remove a filter.
            </EmptyState>
          )}

          <Pagination page={data.page} totalPages={data.totalPages} hrefFor={(page) => link({ page })} />
        </div>
      </div>
    </>
  );
}
