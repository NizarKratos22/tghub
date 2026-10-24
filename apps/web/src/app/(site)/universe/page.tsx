import type { Metadata } from 'next';
import type { CountryStanding, LeaderboardEntry, Pulse, RegionStanding } from '@tgh/shared';
import { PageHeader } from '@/components/layout/PageHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/primitives';
import { HomeStandings, Leaderboard, PulseCard } from '@/features/universe/standings';
import { AchievementGrid, MissionBoard, PlayerCard } from '@/features/universe/UniverseClient';
import { serverApiOr } from '@/lib/api/server';
import styles from './universe.module.css';

export const metadata: Metadata = { title: 'Universe' };

export default async function UniversePage() {
  const [pulse, leaders, regions, countries] = await Promise.all([
    serverApiOr<Pulse | null>('/universe/pulse', null),
    serverApiOr<LeaderboardEntry[]>('/universe/leaderboard', []),
    serverApiOr<RegionStanding[]>('/universe/regions', []),
    serverApiOr<CountryStanding[]>('/universe/countries', []),
  ]);

  return (
    <>
      <PageHeader
        code="Season 1"
        title="Universe"
        lede="Your gamer identity: levels, titles, missions and achievements — plus a community meter everyone fills together."
      />
      <div className="container page stack">
        <div className={styles.top}>
          <PlayerCard />
          {pulse ? <PulseCard pulse={pulse} /> : <EmptyState title="No active season">The next season&apos;s Pulse appears here when it starts.</EmptyState>}
        </div>

        <section>
          <SectionHeader title="Missions" kicker="Progress comes from what you do on TG Hub, counted on the server. Claim each reward before it resets." />
          <MissionBoard />
        </section>

        <div className={styles.standings}>
          <section>
            <SectionHeader title="Season leaderboard" />
            <Leaderboard entries={leaders} />
          </section>
          <section>
            <SectionHeader title="Regions" kicker="Season XP by governorate in Tunisia, or by country worldwide." />
            <HomeStandings regions={regions} countries={countries} />
          </section>
        </div>

        <section>
          <SectionHeader title="Achievements" kicker="One-time unlocks. Some come with a title you can wear on your profile." />
          <AchievementGrid />
        </section>
      </div>
    </>
  );
}
