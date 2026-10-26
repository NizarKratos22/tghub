'use client';

import Link from 'next/link';
import type { TournamentSummary } from '@tgh/shared';
import type { CSSProperties } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { Countdown } from '@/components/ui/time';
import { useFormat, useT } from '@/i18n/I18nProvider';
import { cx } from '@/lib/cx';
import { isUrgent } from '@/lib/format';
import { ProviderBadge, TournamentStatusBadge } from './badges';
import { entrantsLabel, externalCta, teamSizeLabel, whereLabel } from './display';
import { FollowButton } from './FollowButton';
import styles from './TournamentRow.module.css';

function DateBlock({ iso }: { iso: string }) {
  const tile = useFormat().dateTile(iso);
  return (
    <time dateTime={iso} className={styles.date}>
      <span className={styles.weekday}>{tile.weekday}</span>
      <span className={styles.day}>{tile.day}</span>
      <span className={styles.month}>{tile.month}</span>
      <span className={styles.time}>{tile.time}</span>
    </time>
  );
}

function RegistrationLine({ tournament }: { tournament: TournamentSummary }) {
  const t = useT();
  const closesAt = tournament.registration.closesAt;
  if (tournament.status === 'registration_open' && closesAt) {
    return <Countdown iso={closesAt} label={t.tournaments.signupsCloseIn} className={cx(styles.reg, isUrgent(closesAt) && styles.urgent)} />;
  }
  if (tournament.status === 'registration_open') return <span className={styles.reg}>{t.tournaments.signupsOpen}</span>;
  if (tournament.status === 'upcoming') {
    return <Countdown iso={tournament.startsAt} label={t.tournaments.startsIn} className={styles.reg} />;
  }
  return null;
}

/** One line of the schedule. Sign-up always links out to the organizer's platform. */
export function TournamentRow({ tournament }: { tournament: TournamentSummary }) {
  const t = useT();
  const format = useFormat();
  const cta = externalCta(tournament, t);
  const facts = [teamSizeLabel(tournament.teamSize, t, format), whereLabel(tournament, t), entrantsLabel(tournament.participants, t, format), tournament.prize].filter(
    Boolean,
  );

  return (
    <article className={cx(styles.row, tournament.featured && styles.featured)} style={{ '--accent': tournament.game?.accent ?? 'var(--primary)' } as CSSProperties}>
      <DateBlock iso={tournament.startsAt} />
      <div className={styles.main}>
        <div className={styles.badges}>
          <TournamentStatusBadge status={tournament.status} />
          <ProviderBadge provider={tournament.provider} />
          {tournament.isLocal ? <span className={styles.local}>TN</span> : null}
        </div>
        <Link href={`/tournaments/${tournament.slug}`} className={styles.name}>
          {tournament.name}
        </Link>
        <p className={styles.meta}>
          {tournament.game ? (
            <Link href={`/games/${tournament.game.slug}`} className={styles.game}>
              <span className={styles.gameDot} aria-hidden />
              {tournament.game.title}
            </Link>
          ) : tournament.gameName ? (
            <span className={styles.game}>{tournament.gameName}</span>
          ) : null}
          {facts.map((fact) => (
            <span key={fact}>{fact}</span>
          ))}
        </p>
      </div>
      <div className={styles.side}>
        <RegistrationLine tournament={tournament} />
        <div className={styles.actions}>
          <FollowButton tournamentId={tournament.id} slug={tournament.slug} status={tournament.status} size="sm" />
          {cta ? (
            <ButtonLink href={cta.href} target="_blank" rel="noreferrer" size="sm" variant={tournament.status === 'registration_open' ? 'primary' : 'ghost'} iconRight="arrowUpRight">
              {cta.label}
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** Compact line for rails (home, game pages). */
export function TournamentLine({ tournament }: { tournament: TournamentSummary }) {
  const t = useT();
  const format = useFormat();
  const tile = format.dateTile(tournament.startsAt);
  return (
    <Link href={`/tournaments/${tournament.slug}`} className={styles.line}>
      <span className={styles.lineTile}>
        <span>{tile.month}</span>
        <strong>{tile.day}</strong>
      </span>
      <span className={styles.lineMain}>
        <span className={styles.lineName}>{tournament.name}</span>
        <span className={styles.lineSub}>
          {[tournament.game?.title ?? tournament.gameName, whereLabel(tournament, t), teamSizeLabel(tournament.teamSize, t, format)].filter(Boolean).join(' · ')}
        </span>
      </span>
      {tournament.status === 'registration_open' || tournament.status === 'live' ? <TournamentStatusBadge status={tournament.status} /> : null}
    </Link>
  );
}
