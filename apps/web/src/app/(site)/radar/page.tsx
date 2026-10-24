import type { Metadata } from 'next';
import Link from 'next/link';
import { RESOURCE_KIND_LABELS, RESOURCE_KINDS, radarListQuerySchema, type GameSummary, type Page, type Resource } from '@tgh/shared';
import { PageHeader } from '@/components/layout/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, Pagination, SegmentedNav } from '@/components/ui/primitives';
import { MatchingGames } from '@/features/radar/MatchingGames';
import { ResourceRow } from '@/features/radar/ResourceRow';
import { serverApi, serverApiOr } from '@/lib/api/server';
import { cx } from '@/lib/cx';
import { hrefWith, parseParams } from '@/lib/search-params';
import styles from './radar.module.css';

export const metadata: Metadata = { title: 'Radar' };

const PAGE_SIZE = 20;
const TIMED_KINDS = new Set(['deal', 'event']);

export default async function RadarPage(props: PageProps<'/radar'>) {
  const query = parseParams(radarListQuerySchema, await props.searchParams);
  // Deals and events hide ended items unless the reader asks for them.
  const active = query.active ?? (query.kind ? TIMED_KINDS.has(query.kind) : undefined);

  const [data, games] = await Promise.all([
    serverApi<Page<Resource>>('/radar', { query: { ...query, active, pageSize: PAGE_SIZE } }),
    serverApiOr<Page<GameSummary> | null>('/games', null, { query: { pageSize: 14 }, revalidate: 300 }),
  ]);

  const current = { q: query.q, kind: query.kind, game: query.game, active: query.active, page: query.page };
  const link = (changes: Record<string, string | boolean | number | undefined | null>) => hrefWith('/radar', current, changes);
  const selectedGame = games?.items.find((game) => game.slug === query.game);

  const tabs = [
    { href: link({ kind: null, active: null }), label: 'All', active: !query.kind },
    ...RESOURCE_KINDS.map((kind) => ({ href: link({ kind, active: null }), label: RESOURCE_KIND_LABELS[kind], active: query.kind === kind })),
  ];

  return (
    <>
      <PageHeader code="News, patches &amp; deals" title="Radar" lede="Official patch notes, news, guides, deals and events for the games you play — one search, one feed." />
      <div className="container page">
        <form action="/radar" className={styles.search} role="search">
          <Icon name="search" size={20} />
          <input name="q" defaultValue={query.q ?? ''} placeholder="Search patch notes, guides, deals, games…" aria-label="Search the Radar" />
          {query.kind ? <input type="hidden" name="kind" value={query.kind} /> : null}
          {query.game ? <input type="hidden" name="game" value={query.game} /> : null}
          <button type="submit">Search</button>
        </form>

        <SegmentedNav label="Radar categories" items={tabs} />

        <div className={styles.layout}>
          <div className={styles.feed}>
            {query.q ? <MatchingGames q={query.q} /> : null}

            <div className={styles.status}>
              <span>
                <span className="mono">{data.total}</span> {data.total === 1 ? 'item' : 'items'}
                {query.q ? (
                  <>
                    {' '}
                    for <strong>“{query.q}”</strong>
                  </>
                ) : null}
              </span>
              {selectedGame || query.game ? (
                <Link href={link({ game: null })} className={styles.chip}>
                  {selectedGame?.title ?? query.game} <Icon name="close" size={12} />
                </Link>
              ) : null}
              {query.q ? (
                <Link href={link({ q: null })} className={styles.chip}>
                  “{query.q}” <Icon name="close" size={12} />
                </Link>
              ) : null}
              {query.kind && TIMED_KINDS.has(query.kind) ? (
                <Link href={link({ active: active ? false : null })} className={styles.toggle}>
                  {active ? 'Show ended too' : 'Hide ended'}
                </Link>
              ) : null}
            </div>

            {data.items.length > 0 ? (
              <div className={styles.list}>
                {data.items.map((resource) => (
                  <ResourceRow key={resource.id} resource={resource} />
                ))}
              </div>
            ) : (
              <EmptyState title="Nothing on this frequency">
                {query.q ? 'Try a broader term, a game nickname, or another category.' : 'New items appear as sources report them.'}
              </EmptyState>
            )}

            <Pagination page={data.page} totalPages={data.totalPages} hrefFor={(page) => link({ page })} />
          </div>

          {games ? (
            <aside className={styles.side}>
              <p className={styles.sideTitle}>Filter by game</p>
              <ul>
                {games.items.map((game) => (
                  <li key={game.id}>
                    <Link href={link({ game: query.game === game.slug ? null : game.slug })} className={cx(styles.gameLink, query.game === game.slug && styles.gameOn)}>
                      <span className={styles.gameDot} style={{ background: game.accent }} />
                      {game.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
        </div>
      </div>
    </>
  );
}
