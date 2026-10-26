'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { TournamentLine } from '@/features/tournaments/TournamentRow';
import { fill } from '@/i18n/config';
import { useT } from '@/i18n/I18nProvider';
import { api } from '@/lib/api/client';
import styles from './MatchingGames.module.css';

/**
 * Game and tournament matches for a Radar query. Runs in the browser so a signed-in search
 * counts toward "Scout the Radar" (the server dedupes repeats).
 */
export function MatchingGames({ q }: { q: string }) {
  const t = useT();
  const queryClient = useQueryClient();
  const search = useQuery({
    queryKey: ['radar', 'search', q.toLowerCase()],
    queryFn: async () => {
      const result = await api.radar.search(q);
      void queryClient.invalidateQueries({ queryKey: ['universe'] });
      return result;
    },
    enabled: q.trim().length >= 2,
    staleTime: 5 * 60_000,
  });

  const games = search.data?.games ?? [];
  const tournaments = search.data?.tournaments ?? [];
  if (games.length === 0 && tournaments.length === 0) return null;

  return (
    <div className={styles.wrap}>
      {games.length > 0 ? (
        <>
          <p className="label">{fill(t.radar.gamesMatching, { q })}</p>
          <ul className={styles.list}>
            {games.map((game) => (
              <li key={game.id}>
                <Link href={`/games/${game.slug}`} className={styles.game} style={{ '--accent': game.accent } as CSSProperties}>
                  <span className={styles.mono}>{game.monogram}</span>
                  <span className={styles.title}>{game.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {tournaments.length > 0 ? (
        <>
          <p className="label">{t.radar.upcoming}</p>
          <div>
            {tournaments.map((tournament) => (
              <TournamentLine key={tournament.id} tournament={tournament} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
