'use client';

import Link from 'next/link';
import { countryName, homeLabel, type CountryStanding, type LeaderboardEntry, type Pulse, type RegionStanding } from '@tgh/shared';
import { useState } from 'react';
import { Avatar, Meter } from '@/components/ui/primitives';
import { Countdown } from '@/components/ui/time';
import { cx } from '@/lib/cx';
import { formatNumber } from '@/lib/format';
import styles from './standings.module.css';

/** The Pulse: one shared meter for the whole community. */
export function PulseCard({ pulse, compact = false }: { pulse: Pulse; compact?: boolean }) {
  const percent = Math.floor(pulse.progress * 100);
  const next = pulse.milestones.find((m) => !m.reached);
  return (
    <section className={styles.pulse} aria-labelledby="pulse-title">
      <div className={styles.pulseHead}>
        <span className={styles.pulseLabel}>The Pulse</span>
        <Countdown iso={pulse.endsAt} prefix="Season ends in" className={styles.pulseEnds} />
      </div>
      <h2 id="pulse-title" className={styles.pulseTitle}>
        {pulse.title}
      </h2>
      <div className={styles.pulseFigure}>
        <span className={styles.pulsePercent}>
          {percent}
          <small>%</small>
        </span>
        <span className={styles.pulseNumbers}>
          <strong>{formatNumber(pulse.current)}</strong> / {formatNumber(pulse.goal)} XP
          <br />
          {formatNumber(pulse.contributors)} players contributing
        </span>
      </div>
      <Meter value={pulse.progress} tone="gold" height={12} ticks={pulse.milestones.map((m) => m.threshold / pulse.goal)} label="Community Pulse progress" />
      {compact ? (
        next ? (
          <p className={styles.pulseNext}>
            Next at {next.label}: <strong>{next.reward}</strong>
          </p>
        ) : null
      ) : (
        <ol className={styles.milestones}>
          {pulse.milestones.map((milestone) => (
            <li key={milestone.threshold} className={cx(milestone.reached && styles.reached)}>
              <span className={styles.milestoneAt}>{milestone.label}</span>
              <span className={styles.milestoneReward}>{milestone.reward}</span>
              <span className={styles.milestoneState}>{milestone.reached ? 'Unlocked' : `${formatNumber(milestone.threshold)} XP`}</span>
            </li>
          ))}
        </ol>
      )}
      {!compact ? <p className={styles.pulseNote}>{pulse.description}</p> : null}
    </section>
  );
}

export function Leaderboard({ entries, highlightUserId }: { entries: LeaderboardEntry[]; highlightUserId?: string }) {
  if (entries.length === 0) return <p className={styles.muted}>No XP earned this season yet — be the first on the board.</p>;
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Player</th>
          <th scope="col" className={styles.hideSm}>
            Home
          </th>
          <th scope="col" className={styles.num}>
            LV
          </th>
          <th scope="col" className={styles.num}>
            Season XP
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={entry.user.id} className={cx(entry.user.id === highlightUserId && styles.me)}>
            <td className={styles.rankCell}>
              <span className={styles.rank} data-podium={entry.rank <= 3 ? entry.rank : undefined}>
                {entry.rank}
              </span>
            </td>
            <td>
              <Link href={`/u/${entry.user.username}`} className={styles.player}>
                <Avatar name={entry.user.displayName} color={entry.user.avatarColor} src={entry.user.avatarUrl} size={28} />
                <span>
                  <span className={styles.playerName}>{entry.user.displayName}</span>
                  <span className={styles.playerTitle}>{entry.user.title}</span>
                </span>
              </Link>
            </td>
            <td className={cx(styles.region, styles.hideSm)}>{homeLabel(entry.user) ?? '—'}</td>
            <td className={styles.num}>{entry.user.level}</td>
            <td className={cx(styles.num, styles.xp)}>{formatNumber(entry.xp)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StandingBars({ rows, empty }: { rows: Array<{ key: string; name: string; xp: number; players: number }>; empty: string }) {
  if (rows.length === 0) return <p className={styles.muted}>{empty}</p>;
  const top = rows[0]!.xp;
  return (
    <ol className={styles.regions}>
      {rows.map((region, index) => (
        <li key={region.key}>
          <span className={styles.regionRank}>{index + 1}</span>
          <span className={styles.regionName}>{region.name}</span>
          <span className={styles.regionBar}>
            <span style={{ width: `${Math.max(4, (region.xp / top) * 100)}%` }} className={cx(index === 0 && styles.regionLead)} />
          </span>
          <span className={styles.regionXp}>
            {formatNumber(region.xp)}
            <small> · {region.players}p</small>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Season XP by governorate (Tunisia) or by country (world), one switch between them. */
export function HomeStandings({ regions, countries }: { regions: RegionStanding[]; countries: CountryStanding[] }) {
  const [view, setView] = useState<'tn' | 'world'>('tn');
  return (
    <div className={styles.homeStandings}>
      <div className={styles.switch} role="tablist" aria-label="Standings">
        <button type="button" role="tab" aria-selected={view === 'tn'} className={cx(styles.switchTab, view === 'tn' && styles.switchOn)} onClick={() => setView('tn')}>
          Tunisia
        </button>
        <button type="button" role="tab" aria-selected={view === 'world'} className={cx(styles.switchTab, view === 'world' && styles.switchOn)} onClick={() => setView('world')}>
          World
        </button>
      </div>
      {view === 'tn' ? (
        <StandingBars
          rows={regions.map((row) => ({ key: row.region, name: row.region, xp: row.xp, players: row.players }))}
          empty="Governorates appear once players in Tunisia earn XP this season."
        />
      ) : (
        <StandingBars
          rows={countries.map((row) => ({ key: row.country, name: countryName(row.country), xp: row.xp, players: row.players }))}
          empty="Countries appear once players earn XP this season."
        />
      )}
    </div>
  );
}
