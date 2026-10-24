'use client';

import { homeLabel, type Achievement, type Me, type Mission, type MissionCadence } from '@tgh/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Avatar, Meter, Skeleton } from '@/components/ui/primitives';
import { Countdown, RelativeTime } from '@/components/ui/time';
import { SESSION_KEY, SignedIn } from '@/features/auth/session';
import { api } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { formatNumber } from '@/lib/format';
import styles from './UniverseClient.module.css';

const PROGRESSION_KEY = ['universe', 'me'] as const;

function PlayerCardInner({ me }: { me: Me }) {
  const queryClient = useQueryClient();
  const progression = useQuery({ queryKey: PROGRESSION_KEY, queryFn: api.universe.me });
  const history = useQuery({ queryKey: ['universe', 'xp-history'], queryFn: api.universe.xpHistory });
  const equip = useMutation({
    mutationFn: (title: string | null) => api.me.equipTitle(title),
    onSuccess: (updated) => {
      queryClient.setQueryData(SESSION_KEY, updated);
      void queryClient.invalidateQueries({ queryKey: PROGRESSION_KEY });
    },
  });

  const p = progression.data;
  return (
    <section className={styles.card} aria-label="Your progress">
      <div className={styles.identity}>
        <Avatar name={me.displayName} color={me.avatarColor} src={me.avatarUrl} size={64} />
        <div>
          <p className={styles.name}>{me.displayName}</p>
          <p className={styles.handle}>@{me.username}</p>
        </div>
        <div className={styles.level}>
          <span className={styles.levelLabel}>Level</span>
          <span className={styles.levelValue}>{p?.level ?? me.level}</span>
        </div>
      </div>

      {p ? (
        <>
          <div className={styles.xpRow}>
            <Meter value={p.progress} segments={20} height={14} label="Progress to next level" />
            <p className={styles.xpText}>
              <span>
                {formatNumber(p.currentLevelXp)} / {formatNumber(p.nextLevelXp)} XP to level {p.level + 1}
              </span>
              <span>{formatNumber(p.xp)} total</span>
            </p>
          </div>
          <dl className={styles.stats}>
            <div>
              <dt>Season XP</dt>
              <dd>{formatNumber(p.seasonXp)}</dd>
            </div>
            <div>
              <dt>Season rank</dt>
              <dd>{p.seasonRank ? `#${p.seasonRank}` : '—'}</dd>
            </div>
            <div>
              <dt>Home</dt>
              <dd>{homeLabel(me) ?? '—'}</dd>
            </div>
          </dl>
        </>
      ) : (
        <Skeleton height={96} />
      )}

      <label className={styles.titlePicker}>
        <span className={styles.fieldLabel}>Displayed title</span>
        <select value={me.title} onChange={(event) => equip.mutate(event.target.value)} disabled={equip.isPending}>
          {me.availableTitles.map((title) => (
            <option key={title} value={title}>
              {title}
            </option>
          ))}
        </select>
      </label>

      {history.data && history.data.length > 0 ? (
        <div className={styles.history}>
          <p className={styles.fieldLabel}>Recent XP</p>
          <ul>
            {history.data.slice(0, 5).map((entry) => (
              <li key={entry.id}>
                <span className={styles.historyAmount}>+{entry.amount}</span>
                <span className={styles.historyReason}>{entry.reason}</span>
                <RelativeTime iso={entry.createdAt} className={styles.historyTime} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function PlayerCard() {
  return (
    <SignedIn prompt="Your player card lives here" promptText="Sign in to track XP, level up, wear titles and climb your region's standings." loading={<Skeleton height={360} />}>
      {(me) => <PlayerCardInner me={me} />}
    </SignedIn>
  );
}

/* ───────────── Missions ───────────── */

const CADENCE_LABEL: Record<MissionCadence, string> = { daily: 'Daily', weekly: 'Weekly', special: 'Season' };

function MissionRow({ mission }: { mission: Mission }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const claim = useMutation({
    mutationFn: () => api.universe.claim(mission.id),
    onSuccess: ({ progression }) => {
      queryClient.setQueryData(PROGRESSION_KEY, progression);
      void queryClient.invalidateQueries({ queryKey: ['universe'] });
      void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      // Leaderboard and Pulse are server-rendered; pull fresh numbers.
      router.refresh();
    },
  });
  const done = Boolean(mission.completedAt);
  const claimed = Boolean(mission.claimedAt);

  return (
    <li className={cx(styles.mission, done && styles.missionDone, claimed && styles.missionClaimed)}>
      <div className={styles.missionText}>
        <p className={styles.missionTitle}>{mission.title}</p>
        <p className={styles.missionDesc}>{mission.description}</p>
        <div className={styles.pips} aria-label={`${mission.progress} of ${mission.target}`}>
          {mission.target <= 10 ? (
            Array.from({ length: mission.target }, (_, i) => <span key={i} className={cx(styles.pip, i < mission.progress && styles.pipOn)} />)
          ) : (
            <Meter value={mission.progress / mission.target} segments={mission.target > 40 ? 40 : mission.target} height={8} label={mission.title} />
          )}
          <span className={styles.pipCount}>
            {mission.progress}/{mission.target}
          </span>
        </div>
      </div>
      <div className={styles.missionReward}>
        <span className={styles.xp}>+{mission.xpReward} XP</span>
        {claimed ? (
          <span className={styles.claimed}>
            <Icon name="check" size={14} /> Claimed
          </span>
        ) : done ? (
          <Button size="sm" onClick={() => claim.mutate()} loading={claim.isPending}>
            Claim
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function MissionsInner() {
  const missions = useQuery({ queryKey: ['universe', 'missions'], queryFn: api.universe.missions });
  if (!missions.data) return <Skeleton height={320} />;
  const groups = (['daily', 'weekly', 'special'] as const)
    .map((cadence) => ({ cadence, items: missions.data.filter((m) => m.cadence === cadence) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className={styles.missionGroups}>
      {groups.map((group) => (
        <section key={group.cadence} className={styles.group}>
          <header className={styles.groupHead}>
            <h3>{CADENCE_LABEL[group.cadence]}</h3>
            {group.items[0]?.resetsAt ? (
              <Countdown iso={group.items[0].resetsAt} prefix={group.cadence === 'special' ? 'Ends in' : 'Resets in'} className={styles.reset} />
            ) : null}
          </header>
          <ul>
            {group.items.map((mission) => (
              <MissionRow key={mission.id} mission={mission} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function MissionBoard() {
  return (
    <SignedIn prompt="Missions need an account" promptText="Daily and weekly goals that reward XP — progress is tracked on the server from what you actually do." loading={<Skeleton height={320} />}>
      {() => <MissionsInner />}
    </SignedIn>
  );
}

/* ───────────── Achievements ───────────── */

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const unlocked = Boolean(achievement.unlockedAt);
  return (
    <li className={cx(styles.achievement, unlocked ? styles.unlocked : styles.locked)}>
      <div className={styles.achievementHead}>
        <span className={styles.achievementState}>{unlocked ? 'Unlocked' : 'Locked'}</span>
        <span className={styles.rarity}>{achievement.rarity}% of players</span>
      </div>
      <p className={styles.achievementTitle}>{achievement.title}</p>
      <p className={styles.achievementDesc}>{achievement.description}</p>
      <div className={styles.achievementFoot}>
        <span>+{achievement.xpReward} XP</span>
        {achievement.cosmetic ? <span>{achievement.cosmetic.kind === 'title' ? `Title · ${achievement.cosmetic.value}` : 'Profile badge'}</span> : null}
      </div>
    </li>
  );
}

export function AchievementGrid() {
  const achievements = useQuery({ queryKey: ['universe', 'achievements'], queryFn: api.universe.achievements });
  if (!achievements.data) return <Skeleton height={240} />;
  return (
    <ul className={styles.achievements}>
      {achievements.data.map((achievement) => (
        <AchievementCard key={achievement.id} achievement={achievement} />
      ))}
    </ul>
  );
}
