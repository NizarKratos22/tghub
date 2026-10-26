import type { Metadata } from 'next';
import Link from 'next/link';
import { tournamentListQuerySchema, type GameSummary, type Page, type TournamentSummary } from '@tgh/shared';
import { PageHeader } from '@/components/layout/PageHeader';
import { AdminTournamentLinkImport } from '@/features/tournaments/TournamentLinkImport';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, Pagination, SegmentedNav } from '@/components/ui/primitives';
import { SortSelect } from '@/features/games/SortSelect';
import { FollowingStrip } from '@/features/tournaments/FollowingStrip';
import { TournamentRow } from '@/features/tournaments/TournamentRow';
import { getT } from '@/i18n/server';
import { serverApi, serverApiOr } from '@/lib/api/server';
import { cx } from '@/lib/cx';
import { hrefWith, parseParams } from '@/lib/search-params';
import styles from './tournaments.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.nav.tournaments, description: t.tournaments.metaDescription };
}

const PAGE_SIZE = 20;

const LISTS = ['open', 'upcoming', 'live', 'completed'] as const;
const WHERE = ['all', 'tn', 'online'] as const;

export default async function TournamentsPage(props: PageProps<'/tournaments'>) {
  const t = await getT();
  const query = parseParams(tournamentListQuerySchema, await props.searchParams);
  const [data, games] = await Promise.all([
    serverApi<Page<TournamentSummary>>('/tournaments', { query: { ...query, pageSize: PAGE_SIZE } }),
    serverApiOr<Page<GameSummary> | null>('/games', null, { query: { pageSize: 48, sort: 'title' }, revalidate: 300 }),
  ]);

  const current = {
    list: query.list === 'upcoming' ? undefined : query.list,
    where: query.where === 'all' ? undefined : query.where,
    game: query.game,
    q: query.q,
    page: query.page,
  };
  const link = (changes: Record<string, string | number | undefined | null>) => hrefWith('/tournaments', current, changes);

  return (
    <>
      <PageHeader code={t.tournaments.code} title={t.nav.tournaments} lede={t.tournaments.lede} />
      <div className="container page">
        <div className={styles.adminImport}>
          <AdminTournamentLinkImport />
        </div>
        <FollowingStrip />

        <SegmentedNav
          label={t.tournaments.listsLabel}
          items={LISTS.map((list) => ({
            href: link({ list: list === 'upcoming' ? null : list }),
            label: t.tournaments.lists[list],
            active: query.list === list,
          }))}
        />

        <div className={styles.toolbar}>
          <div className={styles.where} role="group" aria-label={t.tournaments.whereLabel}>
            {WHERE.map((where) => (
              <Link key={where} href={link({ where: where === 'all' ? null : where })} className={cx(styles.chip, query.where === where && styles.chipOn)} scroll={false}>
                {t.tournaments.where[where]}
              </Link>
            ))}
          </div>
          <form action="/tournaments" className={styles.search} role="search">
            <Icon name="search" size={16} />
            <input name="q" defaultValue={query.q ?? ''} placeholder={t.tournaments.search} aria-label={t.tournaments.search} />
            {current.list ? <input type="hidden" name="list" value={current.list} /> : null}
            {current.where ? <input type="hidden" name="where" value={current.where} /> : null}
            {query.game ? <input type="hidden" name="game" value={query.game} /> : null}
          </form>
          {games ? (
            <SortSelect
              label={t.tournaments.game}
              value={query.game ?? ''}
              options={[
                { value: '', label: t.tournaments.allGames, href: link({ game: null }) },
                ...games.items.map((game) => ({ value: game.slug, label: game.title, href: link({ game: game.slug }) })),
              ]}
            />
          ) : null}
        </div>

        {data.items.length > 0 ? (
          <div className={styles.list}>
            {data.items.map((tournament) => (
              <TournamentRow key={tournament.id} tournament={tournament} />
            ))}
          </div>
        ) : (
          <EmptyState icon="trophy" title={t.tournaments.emptyTitle}>
            {t.tournaments.empty[query.list]}
          </EmptyState>
        )}

        <Pagination page={data.page} totalPages={data.totalPages} hrefFor={(page) => link({ page })} />

        <aside className={styles.how}>
          <p className={styles.howTitle}>{t.tournaments.howTitle}</p>
          <p>{t.tournaments.how}</p>
        </aside>
      </div>
    </>
  );
}
