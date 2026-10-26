'use client';

import type { Achievement, Me, Mission, ProgressionSnapshot, TrackableEvent, XpEntry } from '@tgh/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type CSSProperties } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Avatar, Meter, Skeleton } from '@/components/ui/primitives';
import { Countdown, RelativeTime } from '@/components/ui/time';
import { useSession, useSignInHref } from '@/features/auth/session';
import { fill } from '@/i18n/config';
import { useFormat, useLocale, useT } from '@/i18n/I18nProvider';
import { placeName, titleName } from '@/i18n/places';
import { api } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { SESSION_KEY, UNIVERSE_KEYS } from '@/lib/query-keys';
import styles from './UniverseClient.module.css';

/** Where each kind of mission is done, for its "Go" link. Check-ins count by themselves. */
const MISSION_LINKS: Partial<Record<TrackableEvent, string>> = {
  'radar.searched': '/radar',
  'game.viewed': '/games',
  'game.favorited': '/games',
  'pc.compat_checked': '/pc',
  'pc.spec_saved': '/pc',
  'tournament.followed': '/tournaments',
};

const useProgression = (enabled: boolean) => useQuery({ queryKey: UNIVERSE_KEYS.progression, queryFn: api.universe.me, enabled });
const useMissions = (enabled: boolean) => useQuery({ queryKey: UNIVERSE_KEYS.missions, queryFn: api.universe.missions, enabled });
const useAchievements = () => useQuery({ queryKey: UNIVERSE_KEYS.achievements, queryFn: api.universe.achievements });

/**
 * The signed-in player, using what the server already knew (`initial`) until
 * the browser's own session check has answered — so a server-rendered page
 * shows the player's data at once instead of a loading state.
 */
function useViewer(initial: Me | undefined) {
  const session = useSession();
  if (session.data !== undefined) return { me: session.data, pending: false };
  return { me: initial ?? null, pending: !initial && session.isPending };
}

const claimable = (missions: Mission[] | undefined) => (missions ?? []).filter((mission) => mission.completedAt && !mission.claimedAt);

/** After claiming: new numbers everywhere, including the server-rendered leaderboard and Pulse. */
function useClaimFinished() {
  const queryClient = useQueryClient();
  const router = useRouter();
  return (progression: ProgressionSnapshot) => {
    queryClient.setQueryData(UNIVERSE_KEYS.progression, progression);
    void queryClient.invalidateQueries({ queryKey: ['universe'] });
    void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    router.refresh();
  };
}

/* ───────────── Player hero ───────────── */

/** Avatar inside a ring that fills towards the next level. */
function LevelRing({ me, progress, level }: { me: Me; progress: number; level: number }) {
  const t = useT();
  const radius = 54;
  const length = 2 * Math.PI * radius;
  return (
    <div className={styles.ring} role="img" aria-label={`${t.universe.level} ${level} · ${Math.floor(progress * 100)}%`}>
      <svg viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r={radius} className={styles.ringTrack} />
        <circle cx="60" cy="60" r={radius} className={styles.ringFill} strokeDasharray={length} strokeDashoffset={length * (1 - progress)} />
      </svg>
      <Avatar name={me.displayName} color={me.avatarColor} src={me.avatarUrl} size={84} />
      <span className={styles.ringLevel}>
        <small>{t.universe.levelShort}</small>
        {level}
      </span>
    </div>
  );
}

function RecentXp({ entries }: { entries: XpEntry[] }) {
  const t = useT();
  if (entries.length === 0) return null;
  return (
    <div className={styles.recent}>
      <p className={styles.label}>{t.universe.recentXp}</p>
      <ul>
        {entries.slice(0, 4).map((entry) => (
          <li key={entry.id}>
            {/* Negative only when the TG Hub team took XP back. */}
            <span className={cx(styles.recentAmount, entry.amount < 0 && styles.recentLoss)}>
              {entry.amount < 0 ? `−${Math.abs(entry.amount)}` : `+${entry.amount}`}
            </span>
            <span className={styles.recentReason}>{entry.reason}</span>
            <RelativeTime iso={entry.createdAt} className={styles.recentTime} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlayerHeroInner({ me }: { me: Me }) {
  const t = useT();
  const format = useFormat();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const progression = useProgression(true);
  const missions = useMissions(true);
  const history = useQuery({ queryKey: UNIVERSE_KEYS.history, queryFn: api.universe.xpHistory });
  const equip = useMutation({
    mutationFn: (title: string | null) => api.me.equipTitle(title),
    onSuccess: (updated) => {
      queryClient.setQueryData(SESSION_KEY, updated);
      void queryClient.invalidateQueries({ queryKey: UNIVERSE_KEYS.progression });
    },
  });

  const p = progression.data;
  const ready = claimable(missions.data);
  const readyXp = ready.reduce((sum, mission) => sum + mission.xpReward, 0);
  if (!p) return <Skeleton height={300} />;

  return (
    <section className={styles.hero} aria-label={t.universe.yourProgress}>
      <div className={styles.heroMain}>
        <LevelRing me={me} progress={p.progress} level={p.level} />
        <div className={styles.who}>
          <p className={styles.name}>
            <bdi>{me.displayName}</bdi>
          </p>
          <p className={styles.handle}>@{me.username}</p>
          <label className={styles.titleChip}>
            <span className="visually-hidden">{t.universe.displayedTitle}</span>
            <Icon name="star" size={14} />
            <select value={me.title} onChange={(event) => equip.mutate(event.target.value)} disabled={equip.isPending} aria-label={t.universe.displayedTitle}>
              {me.availableTitles.map((title) => (
                <option key={title} value={title}>
                  {titleName(title, t)}
                </option>
              ))}
            </select>
            <Icon name="chevronDown" size={14} />
          </label>
        </div>
      </div>

      <div className={styles.xp}>
        <div className={styles.xpTop}>
          <span>{fill(t.universe.toNext, { xp: format.number(Math.max(0, p.nextLevelXp - p.currentLevelXp)), level: p.level + 1 })}</span>
          <span className={styles.xpTotal}>{fill(t.universe.total, { xp: format.number(p.xp) })}</span>
        </div>
        <Meter value={p.progress} segments={20} height={12} label={t.universe.progressNext} />
      </div>

      <dl className={styles.stats}>
        <div>
          <dt>{t.universe.seasonXp}</dt>
          <dd>{format.number(p.seasonXp)}</dd>
        </div>
        <div>
          <dt>{t.universe.seasonRank}</dt>
          <dd>{p.seasonRank ? `#${p.seasonRank}` : '—'}</dd>
        </div>
        <div>
          <dt>{t.universe.home}</dt>
          <dd>{placeName(me, t, locale) ?? '—'}</dd>
        </div>
      </dl>

      {ready.length > 0 ? (
        <a href="#missions" className={styles.ready}>
          <span className={styles.readyIcon}>
            <Icon name="bolt" size={16} />
          </span>
          <span>
            <strong>{format.fill(t.universe.readyToClaim, { count: ready.length })}</strong> · +{format.number(readyXp)} XP
          </span>
          <Icon name="arrowRight" size={16} />
        </a>
      ) : null}

      <RecentXp entries={history.data ?? []} />
    </section>
  );
}

/** Guests: what the page holds for them, and the way in. */
function GuestHero() {
  const t = useT();
  const signInHref = useSignInHref();
  return (
    <section className={cx(styles.hero, styles.guest)}>
      <div className={styles.guestBadge} aria-hidden>
        <span>1</span>
      </div>
      <h2 className={styles.guestTitle}>{t.universe.guestTitle}</h2>
      <p className={styles.guestText}>{t.universe.guestText}</p>
      <ul className={styles.guestPoints}>
        {t.universe.guestPoints.map((point) => (
          <li key={point}>
            <Icon name="check" size={14} />
            {point}
          </li>
        ))}
      </ul>
      <div className={styles.guestActions}>
        <ButtonLink href="/register">{t.auth.submitRegister}</ButtonLink>
        <ButtonLink href={signInHref} variant="outline">
          {t.auth.submitLogin}
        </ButtonLink>
      </div>
    </section>
  );
}

export function PlayerHero({ initialMe }: { initialMe?: Me }) {
  const { me, pending } = useViewer(initialMe);
  if (pending) return <Skeleton height={300} />;
  return me ? <PlayerHeroInner me={me} /> : <GuestHero />;
}

/* ───────────── Section bar ───────────── */

const SECTIONS = ['overview', 'missions', 'standings', 'achievements'] as const;

/** Sticky jump links for the long page, with live counts; the one in view is highlighted. */
export function UniverseNav({ initialMe }: { initialMe?: Me }) {
  const t = useT();
  const { me } = useViewer(initialMe);
  const missions = useMissions(Boolean(me));
  const achievements = useAchievements();
  const [current, setCurrent] = useState<(typeof SECTIONS)[number]>('overview');

  useEffect(() => {
    // Current = the last section whose top has passed under the header and this bar; at the very bottom, the last one.
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = (document.querySelector('header')?.getBoundingClientRect().bottom ?? 0) + 80;
      let next: (typeof SECTIONS)[number] = SECTIONS[0];
      for (const id of SECTIONS) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= line) next = id;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) next = SECTIONS[SECTIONS.length - 1]!;
      setCurrent(next);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const ready = claimable(missions.data).length;
  const unlocked = achievements.data?.filter((a) => a.unlockedAt).length;
  const counts: Partial<Record<(typeof SECTIONS)[number], string>> = {
    missions: ready > 0 ? String(ready) : undefined,
    achievements: achievements.data && me ? `${unlocked}/${achievements.data.length}` : undefined,
  };

  return (
    <nav className={styles.nav} aria-label={t.universe.sectionsLabel}>
      {SECTIONS.map((id) => (
        <a
          key={id}
          href={`#${id}`}
          className={cx(styles.navLink, current === id && styles.navOn)}
          aria-current={current === id ? 'location' : undefined}
          onClick={() => setCurrent(id)}
        >
          {t.universe.sections[id]}
          {counts[id] ? <span className={cx(styles.navCount, id === 'missions' && styles.navReady)}>{counts[id]}</span> : null}
        </a>
      ))}
    </nav>
  );
}

/* ───────────── Missions ───────────── */

function MissionRow({ mission }: { mission: Mission }) {
  const t = useT();
  const finished = useClaimFinished();
  const [popped, setPopped] = useState(false);
  const claim = useMutation({
    mutationFn: () => api.universe.claim(mission.id),
    onSuccess: ({ progression }) => {
      setPopped(true);
      finished(progression);
    },
  });
  const done = Boolean(mission.completedAt);
  const claimed = Boolean(mission.claimedAt);
  const href = MISSION_LINKS[mission.event];
  const progress = mission.progress / mission.target;

  return (
    <li className={cx(styles.mission, done && !claimed && styles.missionReady, claimed && styles.missionClaimed)}>
      <span className={styles.missionState} style={{ '--p': claimed || done ? 1 : progress } as CSSProperties} aria-hidden>
        {claimed ? <Icon name="check" size={14} /> : done ? <Icon name="bolt" size={14} /> : null}
      </span>
      <div className={styles.missionText}>
        <p className={styles.missionTitle}>{mission.title}</p>
        <p className={styles.missionDesc}>{mission.description}</p>
        <div className={styles.missionProgress} aria-label={fill(t.universe.progressOf, { progress: mission.progress, target: mission.target })}>
          <Meter value={progress} height={6} tone={done ? 'gold' : 'primary'} label={mission.title} />
          <span>
            {mission.progress}/{mission.target}
          </span>
        </div>
      </div>
      <div className={styles.missionAction}>
        <span className={styles.reward}>+{mission.xpReward} XP</span>
        {claimed ? (
          <span className={styles.claimed}>{t.universe.claimed}</span>
        ) : done ? (
          <span className={styles.claimWrap}>
            <Button size="sm" variant="gold" onClick={() => claim.mutate()} loading={claim.isPending}>
              {t.universe.claim}
            </Button>
          </span>
        ) : href ? (
          <Link href={href} className={styles.go}>
            {t.universe.go}
            <Icon name="arrowRight" size={14} />
          </Link>
        ) : (
          <span className={styles.auto}>{t.universe.automatic}</span>
        )}
        {popped ? (
          <span className={styles.pop} aria-hidden onAnimationEnd={() => setPopped(false)}>
            +{mission.xpReward} XP
          </span>
        ) : null}
      </div>
    </li>
  );
}

function MissionsInner() {
  const t = useT();
  const format = useFormat();
  const missions = useMissions(true);
  const finished = useClaimFinished();
  const ready = claimable(missions.data);
  const claimAll = useMutation({
    mutationFn: async () => {
      let progression: ProgressionSnapshot | null = null;
      // One at a time: each claim updates the same XP total.
      for (const mission of ready) progression = (await api.universe.claim(mission.id)).progression;
      return progression;
    },
    onSuccess: (progression) => progression && finished(progression),
  });

  if (!missions.data) return <Skeleton height={320} />;
  const total = missions.data.length;
  const done = missions.data.filter((mission) => mission.completedAt).length;
  const left = missions.data.filter((mission) => !mission.completedAt).reduce((sum, mission) => sum + mission.xpReward, 0);
  const groups = (['daily', 'weekly', 'special'] as const)
    .map((cadence) => ({ cadence, items: missions.data.filter((m) => m.cadence === cadence) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className={styles.missionsWrap}>
      <div className={styles.summary}>
        <Meter value={total ? done / total : 0} height={8} tone="gold" label={t.universe.missions} />
        <p>{fill(t.universe.missionsSummary, { done, total, xp: format.number(left) })}</p>
        {ready.length >= 2 ? (
          <Button size="sm" variant="gold" icon="bolt" onClick={() => claimAll.mutate()} loading={claimAll.isPending}>
            {fill(t.universe.claimAll, { xp: format.number(ready.reduce((sum, mission) => sum + mission.xpReward, 0)) })}
          </Button>
        ) : null}
      </div>
      <div className={styles.missionGroups}>
        {groups.map((group) => {
          const groupDone = group.items.filter((mission) => mission.completedAt).length;
          return (
            <section key={group.cadence} className={styles.group}>
              <header className={styles.groupHead}>
                <h3>{t.universe.cadence[group.cadence]}</h3>
                <span className={styles.groupCount}>{fill(t.universe.groupDone, { done: groupDone, total: group.items.length })}</span>
                {group.items[0]?.resetsAt ? (
                  <Countdown iso={group.items[0].resetsAt} label={group.cadence === 'special' ? t.universe.endsIn : t.universe.resetsIn} className={styles.reset} />
                ) : null}
              </header>
              <ul>
                {group.items.map((mission) => (
                  <MissionRow key={mission.id} mission={mission} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function MissionBoard({ initialMe }: { initialMe?: Me }) {
  const t = useT();
  const { me, pending } = useViewer(initialMe);
  const signInHref = useSignInHref();
  if (pending) return <Skeleton height={320} />;
  if (!me) {
    return (
      <div className={styles.locked}>
        <Icon name="lock" size={20} />
        <div>
          <p className={styles.lockedTitle}>{t.universe.missionsPrompt}</p>
          <p className={styles.lockedText}>{t.universe.missionsPromptText}</p>
        </div>
        <ButtonLink href={signInHref} size="sm" variant="outline">
          {t.auth.submitLogin}
        </ButtonLink>
      </div>
    );
  }
  return <MissionsInner />;
}

/* ───────────── Achievements ───────────── */

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const t = useT();
  const format = useFormat();
  const unlocked = Boolean(achievement.unlockedAt);
  return (
    <li className={cx(styles.achievement, unlocked ? styles.unlocked : styles.lockedCard)}>
      <div className={styles.achievementHead}>
        <span className={styles.medal} aria-hidden>
          <Icon name={unlocked ? 'trophy' : 'lock'} size={18} />
        </span>
        <span className={styles.rarity}>{fill(t.universe.rarity, { percent: achievement.rarity })}</span>
      </div>
      <p className={styles.achievementTitle}>{achievement.title}</p>
      <p className={styles.achievementDesc}>{achievement.description}</p>
      <div className={styles.achievementFoot}>
        <span className={styles.reward}>+{format.number(achievement.xpReward)} XP</span>
        {achievement.cosmetic ? (
          <span className={styles.cosmetic}>
            {achievement.cosmetic.kind === 'title' ? fill(t.universe.titleCosmetic, { value: achievement.cosmetic.value }) : t.universe.badgeCosmetic}
          </span>
        ) : null}
        {unlocked && achievement.unlockedAt ? <RelativeTime iso={achievement.unlockedAt} className={styles.when} /> : null}
      </div>
    </li>
  );
}

type Filter = 'all' | 'unlocked' | 'locked';

export function AchievementGrid({ initialMe }: { initialMe?: Me }) {
  const t = useT();
  const { me } = useViewer(initialMe);
  const achievements = useAchievements();
  const [filter, setFilter] = useState<Filter>('all');
  if (!achievements.data) return <Skeleton height={240} />;

  const unlocked = achievements.data.filter((a) => a.unlockedAt);
  // Unlocked first (newest first), then locked ones from most to least common — the easiest next goals.
  const sorted = [...unlocked.sort((a, b) => b.unlockedAt!.localeCompare(a.unlockedAt!)), ...achievements.data.filter((a) => !a.unlockedAt).sort((a, b) => b.rarity - a.rarity)];
  const shown = sorted.filter((a) => filter === 'all' || (filter === 'unlocked' ? a.unlockedAt : !a.unlockedAt));

  return (
    <div className={styles.achievementsWrap}>
      {me ? (
        <div className={styles.summary}>
          <Meter value={achievements.data.length ? unlocked.length / achievements.data.length : 0} height={8} tone="gold" label={t.universe.achievements} />
          <p>{fill(t.universe.achievementsSummary, { unlocked: unlocked.length, total: achievements.data.length })}</p>
          <div className={styles.filters} role="tablist" aria-label={t.universe.achievements}>
            {(['all', 'unlocked', 'locked'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                className={cx(styles.filter, filter === value && styles.filterOn)}
                onClick={() => setFilter(value)}
              >
                {value === 'all' ? t.universe.filterAll : value === 'unlocked' ? t.universe.unlocked : t.universe.locked}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <ul className={styles.achievements}>
        {shown.map((achievement) => (
          <AchievementCard key={achievement.id} achievement={achievement} />
        ))}
      </ul>
    </div>
  );
}
