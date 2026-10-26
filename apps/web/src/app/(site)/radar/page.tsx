import type { Metadata } from 'next';
import Link from 'next/link';
import { RESOURCE_KINDS, radarListQuerySchema, type GameSummary, type Page, type RadarKindCounts, type Resource } from '@tgh/shared';
import type { CSSProperties } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, Pagination } from '@/components/ui/primitives';
import { MatchingGames } from '@/features/radar/MatchingGames';
import { RadarCard, SpotlightStory } from '@/features/radar/RadarCards';
import { KIND_ICONS, toneClass } from '@/features/radar/kinds';
import { TournamentStrip } from '@/features/tournaments/TournamentStrip';
import { fill } from '@/i18n/config';
import { getFormat, getLocale, getT } from '@/i18n/server';
import { serverApi, serverApiOr } from '@/lib/api/server';
import { cx } from '@/lib/cx';
import { hrefWith, parseParams } from '@/lib/search-params';
import styles from './radar.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.nav.radar };
}

const PAGE_SIZE = 20;
const TIMED_KINDS = new Set(['deal', 'event']);

/** The first page opens on three stories — the newest with a picture leads — then the grid carries on in order. */
function spotlight(items: Resource[]): { stories: Resource[]; rest: Resource[] } {
  if (items.length < 6) return { stories: [], rest: items };
  const leadIndex = Math.max(0, items.slice(0, 5).findIndex((item) => item.image));
  const lead = items[leadIndex]!;
  const others = items.filter((_, index) => index !== leadIndex);
  return { stories: [lead, ...others.slice(0, 2)], rest: others.slice(2) };
}

export default async function RadarPage(props: PageProps<'/radar'>) {
  const [t, format, locale] = await Promise.all([getT(), getFormat(), getLocale()]);
  const query = parseParams(radarListQuerySchema, await props.searchParams);
  // Deals and events hide ended items unless the reader asks for them.
  const active = query.active ?? (query.kind ? TIMED_KINDS.has(query.kind) : undefined);

  const [data, games, counts] = await Promise.all([
    serverApi<Page<Resource>>('/radar', { query: { ...query, active, pageSize: PAGE_SIZE } }),
    serverApiOr<Page<GameSummary> | null>('/games', null, { query: { pageSize: 14 }, revalidate: 300 }),
    serverApiOr<RadarKindCounts | null>('/radar/kinds', null, { query: { q: query.q, game: query.game }, revalidate: 60 }),
  ]);

  const current = { q: query.q, kind: query.kind, game: query.game, active: query.active, page: query.page };
  const link = (changes: Record<string, string | boolean | number | undefined | null>) => hrefWith('/radar', current, changes);
  const selectedGame = games?.items.find((game) => game.slug === query.game);
  const { stories, rest } = data.page === 1 && !query.q ? spotlight(data.items) : { stories: [], rest: data.items };
  const [lead, ...side] = stories;

  return (
    <>
      <PageHeader code={t.radar.code} title={t.nav.radar} lede={t.radar.lede} />
      <div className="container page">
        <form action="/radar" className={styles.search} role="search">
          <Icon name="search" size={20} />
          <input name="q" defaultValue={query.q ?? ''} placeholder={t.radar.search} aria-label={t.nav.searchRadar} />
          {query.kind ? <input type="hidden" name="kind" value={query.kind} /> : null}
          {query.game ? <input type="hidden" name="game" value={query.game} /> : null}
          <button type="submit">{t.common.search}</button>
        </form>

        <nav aria-label={t.radar.categories} className={styles.kinds}>
          <Link
            href={link({ kind: null, active: null })}
            scroll={false}
            className={cx(styles.kind, styles.kindAll, !query.kind && styles.kindOn)}
            aria-current={!query.kind ? 'page' : undefined}
          >
            <Icon name="radar" size={15} />
            {t.common.all}
            {counts ? <span className={styles.count}>{format.number(counts.all)}</span> : null}
          </Link>
          {RESOURCE_KINDS.map((kind) => (
            <Link
              key={kind}
              href={link({ kind, active: null })}
              scroll={false}
              className={cx(styles.kind, toneClass(kind), query.kind === kind && styles.kindOn)}
              aria-current={query.kind === kind ? 'page' : undefined}
            >
              <span className={styles.kindIcon}>
                <Icon name={KIND_ICONS[kind]} size={14} />
              </span>
              {t.labels.resourceKind[kind]}
              {counts ? <span className={styles.count}>{format.number(counts[kind])}</span> : null}
            </Link>
          ))}
        </nav>

        {lead ? (
          <section className={styles.spotlight} aria-label={t.radar.spotlight}>
            <SpotlightStory resource={lead} lead />
            {side.length > 0 ? (
              <div className={styles.spotSide}>
                {side.map((resource) => (
                  <SpotlightStory key={resource.id} resource={resource} />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <div className={styles.layout}>
          <div className={styles.feed}>
            {query.q ? <MatchingGames q={query.q} /> : null}

            <div className={styles.status}>
              {lead ? <h2 className={styles.feedTitle}>{t.radar.latest}</h2> : null}
              <span>
                <span className="mono">{format.number(data.total)}</span> {fill(t.radar.items, { count: data.total }, locale)}
                {query.q ? (
                  <>
                    {' '}
                    {t.radar.resultsFor} <strong>“{query.q}”</strong>
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
                  {active ? t.radar.showEnded : t.radar.hideEnded}
                </Link>
              ) : null}
            </div>

            {data.items.length > 0 ? (
              <div className={styles.grid}>
                {rest.map((resource) => (
                  <RadarCard key={resource.id} resource={resource} />
                ))}
              </div>
            ) : (
              <EmptyState title={t.radar.emptyTitle}>{query.q ? t.radar.emptyQuery : t.radar.emptyText}</EmptyState>
            )}

            <Pagination page={data.page} totalPages={data.totalPages} hrefFor={(page) => link({ page })} />
          </div>

          {games ? (
            <aside className={styles.side}>
              <p className={styles.sideTitle}>{t.radar.filterByGame}</p>
              <ul>
                {games.items.map((game) => (
                  <li key={game.id}>
                    <Link
                      href={link({ game: query.game === game.slug ? null : game.slug, page: null })}
                      className={cx(styles.gameLink, query.game === game.slug && styles.gameOn)}
                      style={{ '--accent': game.accent } as CSSProperties}
                      aria-current={query.game === game.slug ? 'true' : undefined}
                    >
                      {game.coverUrl ? (
                        <img src={game.coverUrl} alt="" className={styles.gameCover} loading="lazy" decoding="async" />
                      ) : (
                        <span className={styles.gameCover} aria-hidden>
                          {game.monogram}
                        </span>
                      )}
                      <bdi className={styles.gameTitle}>{game.title}</bdi>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className={styles.sideTournaments}>
                <TournamentStrip game={query.game} />
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </>
  );
}
