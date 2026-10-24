import type { Metadata } from 'next';
import Link from 'next/link';
import type { TournamentDetail } from '@tgh/shared';
import type { CSSProperties } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/primitives';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { RelativeTime } from '@/components/ui/time';
import { ProviderBadge, TournamentStatusBadge } from '@/features/tournaments/badges';
import { entrantsLabel, externalCta, providerLabel, teamSizeLabel, whereLabel } from '@/features/tournaments/display';
import { FollowButton } from '@/features/tournaments/FollowButton';
import { serverApi, serverApiOr } from '@/lib/api/server';
import { cx } from '@/lib/cx';
import { dateTile, formatDateTime } from '@/lib/format';
import styles from './tournament.module.css';

export async function generateMetadata(props: PageProps<'/tournaments/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params;
  const tournament = await serverApiOr<TournamentDetail | null>(`/tournaments/${slug}`, null);
  return tournament ? { title: tournament.name } : { title: 'Tournament not found' };
}

interface Step {
  label: string;
  iso: string | null;
}

function Timeline({ tournament }: { tournament: TournamentDetail }) {
  const steps: Step[] = [
    { label: 'Sign-ups close', iso: tournament.registration.closesAt },
    { label: 'Starts', iso: tournament.startsAt },
    { label: 'Ends', iso: tournament.endsAt },
  ].filter((step) => step.iso);
  // Server-rendered snapshot; the status badge above stays the source of truth.
  const now = Date.now();
  return (
    <ol className={styles.timeline}>
      {steps.map((step) => {
        const done = new Date(step.iso!).getTime() <= now;
        return (
          <li key={step.label} className={cx(done && styles.stepDone)}>
            <span className={styles.stepMark} aria-hidden />
            <span className={styles.stepLabel}>{step.label}</span>
            <time dateTime={step.iso!} className={styles.stepWhen}>
              {formatDateTime(step.iso!)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}

export default async function TournamentPage(props: PageProps<'/tournaments/[slug]'>) {
  const { slug } = await props.params;
  const tournament = await serverApi<TournamentDetail>(`/tournaments/${slug}`);
  const tile = dateTile(tournament.startsAt);
  const cta = externalCta(tournament);
  const site = providerLabel(tournament.provider);
  const standingsEvents = tournament.events.filter((event) => event.standings.length > 0);

  const facts: Array<[string, string | null]> = [
    ['Game', tournament.game?.title ?? tournament.gameName],
    ['Where', whereLabel(tournament)],
    ['Format', tournament.format],
    ['Teams', teamSizeLabel(tournament.teamSize)],
    ['Entrants', entrantsLabel(tournament.participants)],
    ['Prize', tournament.prize],
    ['Organizer', tournament.organizer?.name ?? null],
  ];

  return (
    <>
      <section className={styles.hero} style={{ '--accent': tournament.game?.accent ?? 'var(--primary)' } as CSSProperties}>
        <div className={`container ${styles.heroGrid}`}>
          <time dateTime={tournament.startsAt} className={styles.dateBlock}>
            <span className={styles.dateWeekday}>{tile.weekday}</span>
            <span className={styles.dateDay}>{tile.day}</span>
            <span className={styles.dateMonth}>{tile.month}</span>
            <span className={styles.dateTime}>{tile.time} Tunis</span>
          </time>
          <div className={styles.info}>
            <nav className={styles.crumbs} aria-label="Breadcrumb">
              <Link href="/tournaments">Tournaments</Link>
              <Icon name="chevronRight" size={12} />
              <span>{tournament.game?.title ?? tournament.gameName ?? 'Tournament'}</span>
            </nav>
            <div className={styles.badges}>
              <TournamentStatusBadge status={tournament.status} />
              <ProviderBadge provider={tournament.provider} />
              {tournament.isLocal ? <span className={styles.local}>In Tunisia</span> : null}
            </div>
            <h1 className={styles.title}>{tournament.name}</h1>
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
              {cta ? (
                <ButtonLink href={cta.href} target="_blank" rel="noreferrer" size="lg" variant={tournament.status === 'registration_open' ? 'primary' : 'secondary'} iconRight="arrowUpRight">
                  {cta.label}
                </ButtonLink>
              ) : (
                <span className={styles.noLink}>Sample data — no sign-up link</span>
              )}
              <FollowButton tournamentId={tournament.id} slug={tournament.slug} status={tournament.status} />
              {tournament.followers > 0 ? (
                <span className={styles.followers}>
                  {tournament.followers} {tournament.followers === 1 ? 'player' : 'players'} following
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="container page stack">
        <div className={styles.split}>
          <section>
            <SectionHeader title="Schedule" />
            <Timeline tournament={tournament} />
            <p className={styles.note}>
              Times shown in Tunis time. Following sends a reminder 24 hours before sign-ups close and an hour before the start.
            </p>
          </section>
          <section>
            <SectionHeader title="About" />
            {tournament.description ? <p className={styles.description}>{tournament.description}</p> : <p className={styles.note}>The organizer hasn&apos;t published a description.</p>}
          </section>
        </div>

        <section>
          <SectionHeader title={tournament.status === 'completed' ? 'Results' : 'Events'} />
          {standingsEvents.length > 0 ? (
            <div className={styles.events}>
              {standingsEvents.map((event) => (
                <div key={event.name} className={styles.event}>
                  <p className={styles.eventName}>{event.name}</p>
                  <ol className={styles.standings}>
                    {event.standings.map((standing) => (
                      <li key={`${standing.placement}-${standing.name}`} className={cx(standing.placement <= 3 && styles.podium)}>
                        <span className={styles.placement}>{standing.placement}</span>
                        <span>{standing.name}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          ) : tournament.events.length > 0 ? (
            <ul className={styles.eventList}>
              {tournament.events.map((event) => (
                <li key={event.name}>
                  <span className={styles.eventName}>{event.name}</span>
                  <span className={styles.note}>
                    {[event.gameName, teamSizeLabel(event.teamSize), event.entrants !== null ? `${event.entrants} entrants` : null].filter(Boolean).join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="trophy" title="Brackets live on the organizer's page">
              {cta ? `Pairings and results are published on ${site}.` : 'Results appear here once the platform publishes them.'}
            </EmptyState>
          )}
        </section>

        <p className={styles.attribution}>
          {tournament.provider === 'sample' ? (
            'Sample data for development — not mirrored from any platform.'
          ) : (
            <>
              Mirrored from {site}
              {tournament.lastSyncedAt ? (
                <>
                  {' '}
                  · synced <RelativeTime iso={tournament.lastSyncedAt} />
                </>
              ) : null}
              . Registration, check-in, brackets and results are managed by the organizer on {site}.
            </>
          )}
        </p>
      </div>
    </>
  );
}
