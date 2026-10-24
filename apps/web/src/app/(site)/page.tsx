import Link from 'next/link';
import { RESOURCE_KIND_LABELS, type HomeFeed, type Resource } from '@tgh/shared';
import type { CSSProperties } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, StatusBadge } from '@/components/ui/primitives';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { RelativeTime } from '@/components/ui/time';
import { GameGrid } from '@/features/games/GameCover';
import { ListingGrid } from '@/features/market/ListingCard';
import { DealLine, NewsLine } from '@/features/radar/ResourceRow';
import { TournamentLine } from '@/features/tournaments/TournamentRow';
import { Leaderboard, PulseCard } from '@/features/universe/standings';
import { getT } from '@/i18n/server';
import { serverApi } from '@/lib/api/server';
import { isExternal } from '@/lib/format';
import styles from './home.module.css';

// Rendered per request (the feed itself is cached for 30s) so `next build` never depends on a live API.
export const dynamic = 'force-dynamic';

const QUICK_SEARCHES = ['cs2', 'efootball', 'valorant', 'lol', 'patch notes'];

function LeadStory({ resource }: { resource: Resource }) {
  const external = isExternal(resource.url);
  return (
    <a
      href={resource.url}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className={styles.lead}
      style={{ '--accent': resource.game?.accent ?? 'var(--primary)' } as CSSProperties}
    >
      <span className={styles.leadMeta}>
        <span className={styles.leadKind}>{RESOURCE_KIND_LABELS[resource.kind]}</span>
        {resource.game ? <span>{resource.game.title}</span> : null}
        <RelativeTime iso={resource.publishedAt} />
      </span>
      <span className={styles.leadTitle}>{resource.title}</span>
      {resource.summary ? <span className={styles.leadSummary}>{resource.summary}</span> : null}
      <span className={styles.leadSource}>
        {resource.sourceName}
        <Icon name={external ? 'arrowUpRight' : 'arrowRight'} size={14} />
      </span>
    </a>
  );
}

export default async function HomePage() {
  const t = await getT();
  const feed = await serverApi<HomeFeed>('/home', { revalidate: 30 });
  const [lead, ...latest] = feed.latest;
  // A feed cached by an older API build (30 s window across deploys) may predate this field.
  const tournaments = feed.tournaments ?? [];
  const listings = feed.listings ?? [];

  return (
    <>
      <section className={styles.masthead}>
        <div className={`container ${styles.mastGrid}`}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>
              <span className={styles.eyebrowMark}>TN</span> {t.home.eyebrow}
            </p>
            <h1 className={styles.headline}>
              {t.home.headline[0]} <span>{t.home.headline[1]}</span>
            </h1>
            <p className={styles.lede}>{t.home.lede}</p>
            <form action="/radar" className={styles.search} role="search">
              <Icon name="search" size={20} />
              <input name="q" placeholder={t.home.searchPlaceholder} aria-label={t.nav.searchRadar} autoComplete="off" />
              <button type="submit">{t.common.search}</button>
            </form>
            <p className={styles.quick}>
              <span className="label">{t.home.try}</span>
              {QUICK_SEARCHES.map((q) => (
                <Link key={q} href={`/radar?q=${encodeURIComponent(q)}`}>
                  {q}
                </Link>
              ))}
            </p>
          </div>
          <div className={styles.pulseSlot}>{feed.pulse ? <PulseCard pulse={feed.pulse} compact /> : null}</div>
        </div>
      </section>

      <div className="container page stack">
        <section>
          <SectionHeader title={t.home.featuredGames} action={{ href: '/games', label: t.home.catalogue }} />
          <GameGrid games={feed.featured} />
        </section>

        {listings.length > 0 ? (
          <section>
            <SectionHeader
              title={t.home.freshMarket}
              kicker={t.home.freshMarketKicker}
              action={{ href: '/market', label: t.home.openMarket }}
            />
            <ListingGrid listings={listings.slice(0, 10)} dense />
          </section>
        ) : null}

        <section className={styles.radarGrid}>
          <div>
            <SectionHeader title={t.home.latestRadar} action={{ href: '/radar', label: t.home.openRadar }} />
            {lead ? (
              <>
                <LeadStory resource={lead} />
                <div className={styles.newsList}>
                  {latest.map((resource) => (
                    <NewsLine key={resource.id} resource={resource} />
                  ))}
                </div>
              </>
            ) : (
              <EmptyState title={t.home.radarQuiet}>{t.home.radarQuietText}</EmptyState>
            )}
          </div>
          <aside className={styles.rail}>
            <div>
              <h3 className={styles.railTitle}>
                {t.home.dealsEnding} <Link href="/radar?kind=deal&active=true">{t.common.all}</Link>
              </h3>
              {feed.deals.length > 0 ? (
                feed.deals.map((resource) => <DealLine key={resource.id} resource={resource} />)
              ) : (
                <p className={styles.railEmpty}>{t.home.noDeals}</p>
              )}
            </div>
            <div>
              <h3 className={styles.railTitle}>
                {t.home.tournaments} <Link href="/tournaments">{t.common.all}</Link>
              </h3>
              {tournaments.length > 0 ? (
                tournaments.map((tournament) => <TournamentLine key={tournament.id} tournament={tournament} />)
              ) : (
                <p className={styles.railEmpty}>{t.home.noTournaments}</p>
              )}
            </div>
          </aside>
        </section>

        <section className={styles.lab}>
          <div>
            <p className={styles.labCode}>{t.home.labCode}</p>
            <h2 className={styles.labTitle}>{t.home.labTitle}</h2>
            <p className={styles.labText}>{t.home.labText}</p>
          </div>
          <div className={styles.labSide}>
            <div className={styles.labBadges}>
              <StatusBadge status="recommended" />
              <StatusBadge status="minimum" />
              <StatusBadge status="below" />
            </div>
            <ButtonLink href="/pc" variant="secondary" size="lg" iconRight="arrowRight">
              {t.home.openLab}
            </ButtonLink>
          </div>
        </section>

        <section className={styles.bottomGrid}>
          <div>
            <SectionHeader title={t.home.leaders} action={{ href: '/universe', label: t.nav.universe }} />
            <Leaderboard entries={feed.leaders} />
          </div>
          <div>
            <SectionHeader title={t.home.howXp} />
            <ol className={styles.loop}>
              {t.home.xpSteps.map((step, index) => (
                <li key={step.title}>
                  <span className={styles.loopCode}>{index + 1}</span>
                  <div>
                    <h3 className={styles.loopTitle}>{step.title}</h3>
                    <p className={styles.loopText}>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <ButtonLink href="/universe" variant="outline" iconRight="arrowRight">
              {t.home.seeMissions}
            </ButtonLink>
          </div>
        </section>
      </div>
    </>
  );
}
