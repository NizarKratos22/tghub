import type { Metadata } from 'next';
import type { Achievement, CountryStanding, LeaderboardEntry, Me, Mission, ProgressionSnapshot, Pulse, RegionStanding, XpEntry } from '@tgh/shared';
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/primitives';
import { TournamentStrip } from '@/features/tournaments/TournamentStrip';
import { HomeStandings, Leaderboard, PulseCard } from '@/features/universe/standings';
import { AchievementGrid, MissionBoard, PlayerHero, UniverseNav } from '@/features/universe/UniverseClient';
import { getT } from '@/i18n/server';
import { serverApiOr, viewerApi } from '@/lib/api/server';
import { SESSION_KEY, UNIVERSE_KEYS } from '@/lib/query-keys';
import styles from './universe.module.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.nav.universe };
}

/**
 * The signed-in player's card, missions, XP history and achievements, fetched
 * here with their own token so the page arrives filled in instead of waiting
 * for the browser to load its scripts and then ask. Null for guests.
 */
async function loadViewer() {
  const [me, progression, history, missions, achievements] = await Promise.all([
    viewerApi<Me>('/me'),
    viewerApi<ProgressionSnapshot>('/universe/me'),
    viewerApi<XpEntry[]>('/universe/xp-history'),
    viewerApi<Mission[]>('/universe/missions'),
    viewerApi<Achievement[]>('/universe/achievements'),
  ]);
  return me ? { me, progression, history, missions, achievements } : null;
}

export default async function UniversePage() {
  const [t, pulse, leaders, regions, countries, viewer] = await Promise.all([
    getT(),
    serverApiOr<Pulse | null>('/universe/pulse', null),
    serverApiOr<LeaderboardEntry[]>('/universe/leaderboard', []),
    serverApiOr<RegionStanding[]>('/universe/regions', []),
    serverApiOr<CountryStanding[]>('/universe/countries', []),
    loadViewer(),
  ]);
  const achievements = viewer?.achievements ?? (await serverApiOr<Achievement[] | null>('/universe/achievements', null));

  // Hand what was fetched here to the client components' cache.
  const cache = new QueryClient();
  if (viewer) {
    cache.setQueryData(SESSION_KEY, viewer.me);
    if (viewer.progression) cache.setQueryData(UNIVERSE_KEYS.progression, viewer.progression);
    if (viewer.history) cache.setQueryData(UNIVERSE_KEYS.history, viewer.history);
    if (viewer.missions) cache.setQueryData(UNIVERSE_KEYS.missions, viewer.missions);
  }
  if (achievements) cache.setQueryData(UNIVERSE_KEYS.achievements, achievements);

  return (
    <HydrationBoundary state={dehydrate(cache)}>
      <PageHeader code={t.universe.code} title={t.nav.universe} lede={t.universe.lede} />
      <div className="container page stack">
        <UniverseNav initialMe={viewer?.me} />

        <div id="overview" className={styles.top}>
          <PlayerHero initialMe={viewer?.me} />
          {pulse ? <PulseCard pulse={pulse} /> : <EmptyState title={t.universe.noSeason}>{t.universe.noSeasonText}</EmptyState>}
        </div>

        <section id="missions" className={styles.section}>
          <SectionHeader title={t.universe.missions} kicker={t.universe.missionsKicker} />
          <MissionBoard initialMe={viewer?.me} />
        </section>

        <TournamentStrip limit={4} note={t.universe.tournamentsNote} />

        <div id="standings" className={`${styles.standings} ${styles.section}`}>
          <section>
            <SectionHeader title={t.universe.leaderboard} />
            <Leaderboard entries={leaders} highlightUserId={viewer?.me.id} />
          </section>
          <section>
            <SectionHeader title={t.universe.regions} kicker={t.universe.regionsKicker} />
            <HomeStandings regions={regions} countries={countries} />
          </section>
        </div>

        <section id="achievements" className={styles.section}>
          <SectionHeader title={t.universe.achievements} kicker={t.universe.achievementsKicker} />
          <AchievementGrid initialMe={viewer?.me} />
        </section>
      </div>
    </HydrationBoundary>
  );
}
