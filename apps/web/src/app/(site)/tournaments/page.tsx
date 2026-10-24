import type { Metadata } from 'next';
import Link from 'next/link';
import { tournamentListQuerySchema, type GameSummary, type Page, type TournamentSummary } from '@tgh/shared';
import { PageHeader } from '@/components/layout/PageHeader';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, Pagination, SegmentedNav } from '@/components/ui/primitives';
import { SortSelect } from '@/features/games/SortSelect';
import { FollowingStrip } from '@/features/tournaments/FollowingStrip';
import { TournamentRow } from '@/features/tournaments/TournamentRow';
import { serverApi, serverApiOr } from '@/lib/api/server';
import { cx } from '@/lib/cx';
import { hrefWith, parseParams } from '@/lib/search-params';
import styles from './tournaments.module.css';

export const metadata: Metadata = {
  title: 'Tournaments',
  description: 'Open brackets from start.gg and FACEIT for the games Tunisia plays, with reminders before sign-ups close.',
};

const PAGE_SIZE = 20;

const LISTS = [
  { value: 'open', label: 'Sign-ups open' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'live', label: 'Live' },
  { value: 'completed', label: 'Results' },
] as const;

const WHERE = [
  { value: 'all', label: 'Everywhere' },
  { value: 'tn', label: 'In Tunisia' },
  { value: 'online', label: 'Online' },
] as const;

const EMPTY_COPY: Record<(typeof LISTS)[number]['value'], string> = {
  open: 'Nothing is taking sign-ups for these filters right now.',
  upcoming: 'No upcoming tournaments match these filters.',
  live: 'Nothing is being played right now.',
  completed: 'No results yet for these filters.',
};

export default async function TournamentsPage(props: PageProps<'/tournaments'>) {
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
      <PageHeader
        code="Compete"
        title="Tournaments"
        lede="Open brackets from start.gg and FACEIT for the games Tunisia plays. Sign-ups, check-in and results stay with the organizer — we remind you before they close."
      />
      <div className="container page">
        <FollowingStrip />

        <SegmentedNav
          label="Tournament lists"
          items={LISTS.map((item) => ({
            href: link({ list: item.value === 'upcoming' ? null : item.value }),
            label: item.label,
            active: query.list === item.value,
          }))}
        />

        <div className={styles.toolbar}>
          <div className={styles.where} role="group" aria-label="Where">
            {WHERE.map((item) => (
              <Link
                key={item.value}
                href={link({ where: item.value === 'all' ? null : item.value })}
                className={cx(styles.chip, query.where === item.value && styles.chipOn)}
                scroll={false}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <form action="/tournaments" className={styles.search} role="search">
            <Icon name="search" size={16} />
            <input name="q" defaultValue={query.q ?? ''} placeholder="Search tournaments" aria-label="Search tournaments" />
            {current.list ? <input type="hidden" name="list" value={current.list} /> : null}
            {current.where ? <input type="hidden" name="where" value={current.where} /> : null}
            {query.game ? <input type="hidden" name="game" value={query.game} /> : null}
          </form>
          {games ? (
            <SortSelect
              label="Game"
              value={query.game ?? ''}
              options={[
                { value: '', label: 'All games', href: link({ game: null }) },
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
          <EmptyState icon="trophy" title="No brackets here">
            {EMPTY_COPY[query.list]}
          </EmptyState>
        )}

        <Pagination page={data.page} totalPages={data.totalPages} hrefFor={(page) => link({ page })} />

        <aside className={styles.how}>
          <p className={styles.howTitle}>How this works</p>
          <p>
            TG Hub mirrors tournaments from the platforms that run them — start.gg and FACEIT today. Registration, check-in, brackets and results
            happen on the organizer&apos;s page. Hit <strong>Remind me</strong> and we&apos;ll ping your inbox when sign-ups are about to close and
            just before kick-off.
          </p>
        </aside>
      </div>
    </>
  );
}
