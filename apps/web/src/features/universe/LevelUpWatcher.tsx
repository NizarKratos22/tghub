'use client';

import { levelFromXp, titleForLevel } from '@tgh/shared';
import { useEffect, useRef, useState } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Meter } from '@/components/ui/primitives';
import { useSession } from '@/features/auth/session';
import { formatNumber } from '@/lib/format';
import styles from './LevelUpWatcher.module.css';

const storageKey = (userId: string) => `tgh-level:${userId}`;

function readSeen(userId: string): number | null {
  try {
    const value = Number(localStorage.getItem(storageKey(userId)));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeSeen(userId: string, level: number) {
  try {
    localStorage.setItem(storageKey(userId), String(level));
  } catch {
    // Storage blocked: the popup may show again next visit, which is harmless.
  }
}

interface Celebration {
  level: number;
  from: number;
  xp: number;
  newTitle: string | null;
}

/**
 * Celebrates level-ups wherever the player is. XP is granted on the server, so
 * this watches the session's level (refreshed every minute and after XP actions)
 * and compares it with the last level this browser has shown.
 */
export function LevelUpWatcher() {
  const { data: me } = useSession();
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!me) return;
    const seen = readSeen(me.id);
    writeSeen(me.id, me.level);
    // First visit on this browser: remember the level quietly instead of celebrating old progress.
    if (seen === null || me.level <= seen) return;
    const before = titleForLevel(seen);
    const after = titleForLevel(me.level);
    setCelebration({ level: me.level, from: seen, xp: me.xp, newTitle: after !== before ? after : null });
  }, [me]);

  useEffect(() => {
    if (!celebration) return;
    closeButton.current?.focus();
    const escape = (event: KeyboardEvent) => event.key === 'Escape' && setCelebration(null);
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [celebration]);

  if (!celebration) return null;
  const progress = levelFromXp(celebration.xp);
  const jumped = celebration.level - celebration.from;

  return (
    <div className={styles.overlay} onClick={() => setCelebration(null)}>
      <div className={styles.card} role="dialog" aria-modal="true" aria-labelledby="levelup-title" onClick={(event) => event.stopPropagation()}>
        <button type="button" className={styles.close} onClick={() => setCelebration(null)} aria-label="Close">
          <Icon name="close" size={18} />
        </button>
        <div className={styles.burst} aria-hidden>
          {Array.from({ length: 12 }, (_, i) => (
            <span key={i} style={{ transform: `rotate(${i * 30}deg)` }} />
          ))}
        </div>
        <div className={styles.badge}>
          <span className={styles.badgeLabel}>Level</span>
          <span className={styles.badgeValue}>{celebration.level}</span>
        </div>
        <p className={styles.kicker}>Level up!</p>
        <h2 id="levelup-title" className={styles.title}>
          You reached level {celebration.level}
        </h2>
        <p className={styles.text}>
          {jumped > 1 ? `${jumped} levels since your last visit. ` : ''}
          {celebration.newTitle ? (
            <>
              New title unlocked: <strong>{celebration.newTitle}</strong>. Wear it from the Universe page.
            </>
          ) : (
            'Keep clearing missions to climb the season leaderboard.'
          )}
        </p>
        <div className={styles.progress}>
          <div className={styles.progressText}>
            <span>Next: level {progress.level + 1}</span>
            <span>
              {formatNumber(progress.currentLevelXp)} / {formatNumber(progress.nextLevelXp)} XP
            </span>
          </div>
          <Meter value={progress.progress} tone="gold" height={10} label="Progress to the next level" />
        </div>
        <div className={styles.actions}>
          <ButtonLink href="/universe" icon="star" onClick={() => setCelebration(null)}>
            See missions
          </ButtonLink>
          <button type="button" ref={closeButton} className={styles.later} onClick={() => setCelebration(null)}>
            Nice!
          </button>
        </div>
      </div>
    </div>
  );
}
