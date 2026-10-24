'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSession } from '@/features/auth/session';
import { api } from '@/lib/api/client';
import { dateTile } from '@/lib/format';
import { TournamentStatusBadge } from './badges';
import styles from './FollowingStrip.module.css';

/** Signed-in players see the tournaments they get reminders for, soonest first. */
export function FollowingStrip() {
  const { data: me } = useSession();
  const following = useQuery({ queryKey: ['tournaments', 'following'], queryFn: api.tournaments.following, enabled: Boolean(me) });
  const items = following.data ?? [];
  if (!me || items.length === 0) return null;

  return (
    <section className={styles.strip} aria-label="Your tournaments">
      <p className={styles.title}>Your reminders <span>{items.length}</span></p>
      <ul className={styles.list}>
        {items.map((tournament) => {
          const tile = dateTile(tournament.startsAt);
          return (
            <li key={tournament.id}>
              <Link href={`/tournaments/${tournament.slug}`} className={styles.card}>
                <span className={styles.when}>
                  {tile.weekday} {tile.day} {tile.month} · {tile.time}
                </span>
                <span className={styles.name}>{tournament.name}</span>
                <TournamentStatusBadge status={tournament.status} />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
