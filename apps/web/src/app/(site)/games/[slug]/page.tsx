import type { Metadata } from 'next';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { GENRE_LABELS, PLATFORM_LABELS, type GameDetail, type Page, type RequirementTier, type Resource, type TournamentSummary } from '@tgh/shared';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, Tag } from '@/components/ui/primitives';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { FavoriteButton, QuickCheck, ViewTracker } from '@/features/games/GameActions';
import { GameCover } from '@/features/games/GameCover';
import { ResourceRow } from '@/features/radar/ResourceRow';
import { TournamentRow } from '@/features/tournaments/TournamentRow';
import { serverApi, serverApiOr } from '@/lib/api/server';
import { formatDateYear } from '@/lib/format';
import styles from './game.module.css';

export async function generateMetadata(props: PageProps<'/games/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params;
  const game = await serverApiOr<GameDetail | null>(`/games/${slug}`, null, { revalidate: 300 });
  return game ? { title: game.title, description: game.tagline } : { title: 'Game not found' };
}

const ROWS: Array<{ label: string; value: (tier: RequirementTier) => string | null }> = [
  { label: 'Processor', value: (t) => t.cpuLabel },
  { label: 'Graphics', value: (t) => t.gpuLabel },
  { label: 'Memory', value: (t) => `${t.ramGb} GB RAM` },
  { label: 'Video memory', value: (t) => (t.vramGb ? `${t.vramGb} GB` : null) },
  { label: 'Storage', value: (t) => (t.storageGb ? `${t.storageGb} GB` : null) },
  { label: 'OS', value: (t) => t.os },
];

function RequirementsTable({ game }: { game: GameDetail }) {
  const { minimum, recommended, source } = game.requirements;
  if (!minimum && !recommended) {
    return (
      <EmptyState icon="cpu" title={game.platforms.includes('pc') ? 'Requirements not on file yet' : 'No PC version'}>
        {game.platforms.includes('pc')
          ? 'We only show specs the developer has published, and we are still verifying these.'
          : `${game.title} is played on ${game.platforms.map((p) => PLATFORM_LABELS[p]).join(', ')}.`}
      </EmptyState>
    );
  }
  const rows = ROWS.filter((row) => (minimum && row.value(minimum)) || (recommended && row.value(recommended)));
  return (
    <div className={styles.reqCard}>
      <div className={styles.reqWrap}>
        <table className={styles.req}>
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">Minimum</th>
              {recommended ? (
                <th scope="col" className={styles.recHead}>
                  Recommended
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{minimum ? (row.value(minimum) ?? '—') : '—'}</td>
                {recommended ? <td>{row.value(recommended) ?? '—'}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.source}>
        Source: {source ?? 'Developer'}
        {!recommended ? ' — the developer publishes a single spec tier.' : '.'} Always confirm on the official store page.
      </p>
    </div>
  );
}

export default async function GamePage(props: PageProps<'/games/[slug]'>) {
  const { slug } = await props.params;
  const [game, radar, tournaments] = await Promise.all([
    serverApi<GameDetail>(`/games/${slug}`, { revalidate: 60 }),
    serverApiOr<Page<Resource> | null>('/radar', null, { query: { game: slug, pageSize: 8 }, revalidate: 60 }),
    serverApiOr<Page<TournamentSummary> | null>('/tournaments', null, { query: { game: slug, pageSize: 4 } }),
  ]);
  const hasRequirements = Boolean(game.requirements.minimum || game.requirements.recommended);

  const facts: Array<[string, string | null]> = [
    ['Developer', game.developer || null],
    ['Publisher', game.publisher || null],
    ['Released', game.releaseYear ? String(game.releaseYear) : null],
    ['Platforms', game.platforms.map((p) => PLATFORM_LABELS[p]).join(' · ')],
    ['Modes', game.modes.length ? game.modes.map((m) => m.replace('-', ' ')).join(' · ') : null],
    ['Languages', game.languages.length ? game.languages.join(' · ') : null],
  ];

  return (
    <>
      <ViewTracker slug={game.slug} />
      <section className={styles.hero} style={{ '--accent': game.accent } as CSSProperties}>
        <div className={`container ${styles.heroGrid}`}>
          <GameCover game={game} link={false} size="lg" className={styles.cover} />
          <div className={styles.info}>
            <nav className={styles.crumbs} aria-label="Breadcrumb">
              <Link href="/games">Games</Link>
              <Icon name="chevronRight" size={12} />
              <span>{game.title}</span>
            </nav>
            <div className={styles.tags}>
              {game.genres.map((genre) => (
                <Tag key={genre}>{GENRE_LABELS[genre]}</Tag>
              ))}
              {game.freeToPlay ? <Tag tone="success">Free-to-play</Tag> : null}
            </div>
            <h1 className={styles.title}>{game.title}</h1>
            {game.tagline ? <p className={styles.tagline}>{game.tagline}</p> : null}
            {game.description ? <p className={styles.description}>{game.description}</p> : null}
            <dl className={styles.facts}>
              {facts
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
            </dl>
            <div className={styles.actions}>
              <FavoriteButton gameId={game.id} />
              {hasRequirements ? (
                <ButtonLink href={`/pc?game=${game.slug}`} variant="outline" icon="cpu">
                  PC Lab
                </ButtonLink>
              ) : null}
              {game.links.official ? (
                <ButtonLink href={game.links.official} target="_blank" rel="noreferrer" variant="ghost" iconRight="arrowUpRight">
                  Official site
                </ButtonLink>
              ) : null}
              {game.links.store ? (
                <ButtonLink href={game.links.store} target="_blank" rel="noreferrer" variant="ghost" iconRight="arrowUpRight">
                  Store page
                </ButtonLink>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className={`container page stack`}>
        <div className={styles.split}>
          <section>
            <SectionHeader title="System requirements" />
            <RequirementsTable game={game} />
          </section>
          {hasRequirements ? (
            <section>
              <SectionHeader title="Will it run?" />
              <QuickCheck game={game} />
            </section>
          ) : null}
        </div>

        {tournaments && tournaments.items.length > 0 ? (
          <section>
            <SectionHeader
              title="Tournaments"
              action={{ href: `/tournaments?game=${game.slug}`, label: `All ${game.title} brackets` }}
            />
            <div className={styles.list}>
              {tournaments.items.map((tournament) => (
                <TournamentRow key={tournament.id} tournament={tournament} />
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <SectionHeader title="On the Radar" action={{ href: `/radar?game=${game.slug}`, label: 'Everything for this game' }} />
          {radar && radar.items.length > 0 ? (
            <div className={styles.list}>
              {radar.items.map((resource) => (
                <ResourceRow key={resource.id} resource={resource} />
              ))}
            </div>
          ) : (
            <EmptyState title="Nothing on the Radar yet">
              Favourite {game.title} to get its patch notes and announcements in your inbox as soon as a source reports them.
            </EmptyState>
          )}
        </section>
      </div>
    </>
  );
}
