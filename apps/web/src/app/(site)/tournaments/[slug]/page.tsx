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
import { fill } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { getFormat, getT } from '@/i18n/server';
import { serverApi, serverApiOr } from '@/lib/api/server';
import { cx } from '@/lib/cx';
import type { Format } from '@/lib/format';
import styles from './tournament.module.css';

export async function generateMetadata(props: PageProps<'/tournaments/[slug]'>): Promise<Metadata> {
  const { slug } = await props.params;
  const [t, tournament] = await Promise.all([getT(), serverApiOr<TournamentDetail | null>(`/tournaments/${slug}`, null)]);
  return tournament ? { title: tournament.name } : { title: t.tournaments.notFound };
}

interface Step {
  label: string;
  iso: string | null;
}

function Timeline({ tournament, t, format }: { tournament: TournamentDetail; t: Dictionary; format: Format }) {
  const steps: Step[] = [
    { label: t.tournaments.signupsClose, iso: tournament.registration.closesAt },
    { label: t.tournaments.starts, iso: tournament.startsAt },
    { label: t.tournaments.ends, iso: tournament.endsAt },
  ].filter((step) => step.iso);
  // Server-rendered snapshot; the status badge above stays the source of truth.
  // eslint-disable-next-line react-hooks/purity -- server component: rendered once per request, never re-rendered on the client.
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
              {format.dateTime(step.iso!)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}

export default async function TournamentPage(props: PageProps<'/tournaments/[slug]'>) {
  const { slug } = await props.params;
  const [t, format, tournament] = await Promise.all([getT(), getFormat(), serverApi<TournamentDetail>(`/tournaments/${slug}`)]);
  const tile = format.dateTile(tournament.startsAt);
  const cta = externalCta(tournament, t);
  const site = providerLabel(tournament.provider, t);
  const standingsEvents = tournament.events.filter((event) => event.standings.length > 0);

  const facts: Array<[string, string | null]> = [
    [t.tournaments.facts.game, tournament.game?.title ?? tournament.gameName],
    [t.tournaments.facts.where, whereLabel(tournament, t)],
    [t.tournaments.facts.format, tournament.format],
    [t.tournaments.facts.teams, teamSizeLabel(tournament.teamSize, t, format)],
    [t.tournaments.facts.entrants, entrantsLabel(tournament.participants, t, format)],
    [t.tournaments.facts.prize, tournament.prize],
    [t.tournaments.facts.organizer, tournament.organizer?.name ?? null],
  ];

  return (
    <>
      <section className={styles.hero} style={{ '--accent': tournament.game?.accent ?? 'var(--primary)' } as CSSProperties}>
        <div className={`container ${styles.heroGrid}`}>
          <time dateTime={tournament.startsAt} className={styles.dateBlock}>
            <span className={styles.dateWeekday}>{tile.weekday}</span>
            <span className={styles.dateDay}>{tile.day}</span>
            <span className={styles.dateMonth}>{tile.month}</span>
            <span className={styles.dateTime}>{fill(t.tournaments.tunisTime, { time: tile.time })}</span>
          </time>
          <div className={styles.info}>
            <nav className={styles.crumbs} aria-label={t.listing.breadcrumb}>
              <Link href="/tournaments">{t.nav.tournaments}</Link>
              <Icon name="chevronRight" size={12} />
              <span>{tournament.game?.title ?? tournament.gameName ?? t.tournaments.tournament}</span>
            </nav>
            <div className={styles.badges}>
              <TournamentStatusBadge status={tournament.status} />
              <ProviderBadge provider={tournament.provider} />
              {tournament.isLocal ? <span className={styles.local}>{t.tournaments.inTunisia}</span> : null}
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
                <span className={styles.noLink}>{t.tournaments.sampleNoLink}</span>
              )}
              <FollowButton tournamentId={tournament.id} slug={tournament.slug} status={tournament.status} />
              {tournament.followers > 0 ? (
                <span className={styles.followers}>{format.fill(t.tournaments.followers, { count: tournament.followers })}</span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="container page stack">
        <div className={styles.split}>
          <section>
            <SectionHeader title={t.tournaments.schedule} />
            <Timeline tournament={tournament} t={t} format={format} />
            <p className={styles.note}>{t.tournaments.scheduleNote}</p>
          </section>
          <section>
            <SectionHeader title={t.tournaments.about} />
            {tournament.description ? <p className={styles.description}>{tournament.description}</p> : <p className={styles.note}>{t.tournaments.noDescription}</p>}
          </section>
        </div>

        <section>
          <SectionHeader title={tournament.status === 'completed' ? t.tournaments.results : t.tournaments.events} />
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
                    {[event.gameName, teamSizeLabel(event.teamSize, t, format), event.entrants !== null ? format.fill(t.tournaments.entrantsCount, { count: event.entrants }) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon="trophy" title={t.tournaments.bracketsElsewhere}>
              {cta ? fill(t.tournaments.pairingsOn, { site }) : t.tournaments.resultsAppear}
            </EmptyState>
          )}
        </section>

        <p className={styles.attribution}>
          {tournament.provider === 'sample' ? (
            t.tournaments.sampleAttribution
          ) : (
            <>
              {fill(t.tournaments.mirroredFrom, { site })}
              {tournament.lastSyncedAt ? (
                <>
                  {' '}
                  · {t.tournaments.synced} <RelativeTime iso={tournament.lastSyncedAt} />
                </>
              ) : null}
              . {fill(t.tournaments.managedBy, { site })}
            </>
          )}
        </p>
      </div>
    </>
  );
}
