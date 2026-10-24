/**
 * The level curve is shared so every client renders the same XP bar.
 * The API stays the source of truth: it stores the awarded XP and level.
 */

export const LEVEL_TITLES = [
  { level: 1, title: 'Rookie' },
  { level: 5, title: 'Contender' },
  { level: 10, title: 'Challenger' },
  { level: 20, title: 'Veteran' },
  { level: 30, title: 'Elite' },
  { level: 45, title: 'Legend' },
  { level: 60, title: 'Mythic' },
] as const;

export const MAX_LEVEL = 99;

/** XP needed to go from `level` to `level + 1`. */
export function xpForNextLevel(level: number): number {
  return 100 + (level - 1) * 50;
}

export interface LevelProgress {
  level: number;
  /** XP earned inside the current level. */
  currentLevelXp: number;
  /** XP the current level requires in total. */
  nextLevelXp: number;
  /** 0..1 */
  progress: number;
}

export function levelFromXp(totalXp: number): LevelProgress {
  let level = 1;
  let remaining = Math.max(0, Math.floor(totalXp));
  while (level < MAX_LEVEL && remaining >= xpForNextLevel(level)) {
    remaining -= xpForNextLevel(level);
    level += 1;
  }
  const nextLevelXp = xpForNextLevel(level);
  return {
    level,
    currentLevelXp: remaining,
    nextLevelXp,
    progress: level >= MAX_LEVEL ? 1 : remaining / nextLevelXp,
  };
}

export function titleForLevel(level: number): string {
  let title: string = LEVEL_TITLES[0].title;
  for (const tier of LEVEL_TITLES) {
    if (level >= tier.level) title = tier.title;
  }
  return title;
}

/** Level titles a player has earned, used when equipping a title. */
export function unlockedLevelTitles(level: number): string[] {
  return LEVEL_TITLES.filter((tier) => level >= tier.level).map((tier) => tier.title);
}
