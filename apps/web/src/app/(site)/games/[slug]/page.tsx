import type { Metadata } from 'next';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { GameDetail, GuideSummary, Page, RequirementTier, Resource, TournamentSummary } from '@tgh/shared';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, Tag } from '@/components/ui/primitives';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { FavoriteButton, QuickCheck, ViewTracker } from '@/features/games/GameActions';
import { GameCover } from '@/features/games/GameCover';
import { GameMedia } from '@/features/games/GameMedia';
import { RadarCard } from '@/features/radar/RadarCards';
import { AdminTournamentLinkImport } from '@/features/tournaments/TournamentLinkImport';
import { TournamentRow } from '@/features/tournaments/TournamentRow';
import { fill } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { getFormat, getT } from '@/i18n/server';
import { serverApi, serverApiOr } from '@/lib/api/server';
import type { Format } from '@/lib/format';
import styles from './game.module.css';

export async function generateMetadata(props: PageProps<'/games/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params;
  const [t, game] = await Promise.all([getT(), serverApiOr<GameDetail | null>(`/games/${slug}`, null, { revalidate: 300 })]);
  return game ? { title: game.title, description: game.tagline } : { title: t.games.notFound };
}

type RowKey = keyof Dictionary['games']['rows'];

function requirementRows(t: Dictionary): Array<{ key: RowKey; value: (tier: RequirementTier) => string | null }> {
  const gb = (value: number) => fill(t.pc.gbValue, { value });
  return [
    { key: 'cpu', value: (tier) => tier.cpuLabel },
    { key: 'gpu', value: (tier) => tier.gpuLabel },
    { key: 'ram', value: (tier) => fill(t.games.ramValue, { gb: tier.ramGb }) },
    { key: 'vram', value: (tier) => (tier.vramGb ? gb(tier.vramGb) : null) },
    { key: 'storage', value: (tier) => (tier.storageGb ? gb(tier.storageGb) : null) },
    { key: 'os', value: (tier) => tier.os },
  ];
}

function RequirementsTable({ game, t, format }: { game: GameDetail; t: Dictionary; format: Format }) {
  const { minimum, recommended, source } = game.requirements;
  if (!minimum && !recommended) {
    return (
      <EmptyState icon="cpu" title={game.platforms.includes('pc') ? t.games.noRequirements : t.games.noPc}>
        {game.platforms.includes('pc')
          ? t.games.noRequirementsText
          : fill(t.games.playedOn, { game: game.title, platforms: format.list(game.platforms.map((p) => t.labels.platform[p])) })}
      </EmptyState>
    );
  }
  const rows = requirementRows(t).filter((row) => (minimum && row.value(minimum)) || (recommended && row.value(recommended)));
  return (
    <div className={styles.reqCard}>
      <div className={styles.reqWrap}>
        <table className={styles.req}>
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">{t.games.minimum}</th>
              {recommended ? (
                <th scope="col" className={styles.recHead}>
                  {t.games.recommended}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th scope="row">{t.games.rows[row.key]}</th>
                <td>{minimum ? (row.value(minimum) ?? '—') : '—'}</td>
                {recommended ? <td>{row.value(recommended) ?? '—'}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.source}>
        {fill(t.games.source, { source: source ?? t.games.developer })}
        {!recommended ? t.games.singleTier : '.'} {t.games.confirmStore}
      </p>
    </div>
  );
}

export default async function GamePage(props: PageProps<'/games/[slug]'>) {
  const { slug } = await props.params;
  const [t, format, game, radar, tournaments] = await Promise.all([
    getT(),
    getFormat(),
    serverApi<GameDetail>(`/games/${slug}`, { revalidate: 60 }),
    serverApiOr<Page<Resource> | null>('/radar', null, { query: { game: slug, pageSize: 8 }, revalidate: 60 }),
    serverApiOr<Page<TournamentSummary> | null>('/tournaments', null, { query: { game: slug, pageSize: 4 } }),
  ]);
  const hasGuide = (await serverApiOr<GuideSummary[]>('/guides', [], { revalidate: 120 })).some((guide) => guide.game.slug === slug);
  const hasRequirements = Boolean(game.requirements.minimum || game.requirements.recommended);
  // Languages are listed Arabic, French, English first; the long tail collapses into a count.
  const shownLanguages = game.languages.slice(0, 4);
  const moreLanguages = game.languages.length - shownLanguages.length;

  const facts: Array<[string, string | null]> = [
    [t.games.facts.developer, game.developer || null],
    [t.games.facts.publisher, game.publisher || null],
    [t.games.facts.released, game.releaseYear ? String(game.releaseYear) : null],
    [t.games.facts.platforms, game.platforms.map((p) => t.labels.platform[p]).join(' · ')],
    [t.games.facts.modes, game.modes.length ? game.modes.map((m) => t.games.modes[m]).join(' · ') : null],
    [
      t.games.facts.languages,
      game.languages.length ? `${shownLanguages.join(' · ')}${moreLanguages > 0 ? ` ${fill(t.games.moreLanguages, { count: moreLanguages })}` : ''}` : null,
    ],
    [
      t.games.rating,
      game.rating ? `${fill(t.games.ratingValue, { score: game.rating.score })} · ${format.fill(t.games.ratingCount, { count: game.rating.count })}` : null,
    ],
  ];

  return (
    <>
      <ViewTracker slug={game.slug} />
      <section className={styles.hero} style={{ '--accent': game.accent } as CSSProperties}>
        {game.artworkUrl ? (
          <img src={game.artworkUrl} alt="" className={styles.backdrop} fetchPriority="high" />
        ) : null}
        <div className={`container ${styles.heroGrid}`}>
          <GameCover game={game} link={false} size="lg" className={styles.cover} />
          <div className={styles.info}>
            <nav className={styles.crumbs} aria-label={t.listing.breadcrumb}>
              <Link href="/games">{t.nav.games}</Link>
              <Icon name="chevronRight" size={12} />
              <span>{game.title}</span>
            </nav>
            <div className={styles.tags}>
              {game.genres.map((genre) => (
                <Tag key={genre}>{t.labels.genre[genre]}</Tag>
              ))}
              {game.freeToPlay ? <Tag tone="success">{t.games.freeToPlay}</Tag> : null}
            </div>
            <h1 className={styles.title}>{game.title}</h1>
            {game.tagline ? <p className={styles.tagline}>{game.tagline}</p> : null}
            {game.description ? (
              <p className={styles.description} dir="auto">
                {game.description}
              </p>
            ) : null}
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
              {hasGuide ? (
                <ButtonLink href={`/guides/${game.slug}`} variant="secondary" icon="map">
                  {t.guides.competitiveGuide}
                </ButtonLink>
              ) : null}
              {hasRequirements ? (
                <ButtonLink href={`/pc?game=${game.slug}`} variant="outline" icon="cpu">
                  {t.nav.pc}
                </ButtonLink>
              ) : null}
              {game.links.official ? (
                <ButtonLink href={game.links.official} target="_blank" rel="noreferrer" variant="ghost" iconRight="arrowUpRight">
                  {t.games.officialSite}
                </ButtonLink>
              ) : null}
              {game.links.store ? (
                <ButtonLink href={game.links.store} target="_blank" rel="noreferrer" variant="ghost" iconRight="arrowUpRight">
                  {t.games.storePage}
                </ButtonLink>
              ) : null}
            </div>
            {game.igdbUrl ? (
              <p className={styles.credit}>
                {t.games.dataFrom}{' '}
                <a href={game.igdbUrl} target="_blank" rel="noreferrer">
                  IGDB.com
                </a>
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <div className={`container page stack`}>
        {game.screenshots.length > 0 || game.videos.length > 0 ? (
          <section>
            <SectionHeader title={t.games.media} />
            <GameMedia title={game.title} screenshots={game.screenshots} videos={game.videos} />
          </section>
        ) : null}
        <div className={styles.split}>
          <section>
            <SectionHeader title={t.games.requirements} />
            <RequirementsTable game={game} t={t} format={format} />
          </section>
          {hasRequirements ? (
            <section>
              <SectionHeader title={t.games.willItRun} />
              <QuickCheck game={game} />
            </section>
          ) : null}
        </div>

        {tournaments && tournaments.items.length > 0 ? (
          <section>
            <SectionHeader
              title={t.nav.tournaments}
              action={{ href: `/tournaments?game=${game.slug}`, label: fill(t.games.allBrackets, { game: game.title }) }}
            />
            <div className={styles.list}>
              {tournaments.items.map((tournament) => (
                <TournamentRow key={tournament.id} tournament={tournament} />
              ))}
            </div>
            <div className={styles.adminImport}>
              <AdminTournamentLinkImport />
            </div>
          </section>
        ) : (
          <AdminTournamentLinkImport />
        )}

        <section>
          <SectionHeader title={t.games.onRadar} action={{ href: `/radar?game=${game.slug}`, label: t.games.everything }} />
          {radar && radar.items.length > 0 ? (
            <div className={styles.radarGrid}>
              {radar.items.map((resource) => (
                <RadarCard key={resource.id} resource={resource} showGame={false} />
              ))}
            </div>
          ) : (
            <EmptyState title={t.games.radarEmpty}>
              {fill(t.games.radarEmptyText, { game: game.title })}
            </EmptyState>
          )}
        </section>
      </div>
    </>
  );
}
