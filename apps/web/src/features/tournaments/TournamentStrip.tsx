import type { Page, TournamentSummary } from '@tgh/shared';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { getT } from '@/i18n/server';
import { serverApiOr } from '@/lib/api/server';
import { AdminTournamentLinkImport } from './TournamentLinkImport';
import { TournamentLine } from './TournamentRow';
import styles from './TournamentStrip.module.css';

/**
 * A few upcoming tournaments (for one game, when given), linking on to the
 * full list — for pages where players might want a bracket next. Renders
 * nothing when there are none, except the admin's "add by link" box.
 */
export async function TournamentStrip({ game, limit = 3, note }: { game?: string; limit?: number; note?: string }) {
  const t = await getT();
  const data = await serverApiOr<Page<TournamentSummary> | null>('/tournaments', null, {
    query: { list: 'upcoming', game, pageSize: limit },
    revalidate: 120,
  });
  const items = data?.items ?? [];
  const href = game ? `/tournaments?game=${game}` : '/tournaments';

  return (
    <section className={styles.strip} aria-label={t.radar.upcoming}>
      {items.length > 0 ? (
        <>
          <header className={styles.head}>
            <span className={styles.icon} aria-hidden>
              <Icon name="trophy" size={16} />
            </span>
            <h2>{t.radar.upcoming}</h2>
            <Link href={href} className={styles.all}>
              {t.common.all}
              <Icon name="chevronRight" size={14} />
            </Link>
          </header>
          {note ? <p className={styles.note}>{note}</p> : null}
          <div className={styles.list}>
            {items.map((tournament) => (
              <TournamentLine key={tournament.id} tournament={tournament} />
            ))}
          </div>
        </>
      ) : null}
      <AdminTournamentLinkImport />
    </section>
  );
}
