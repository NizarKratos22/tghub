import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { levelFromXp, titleForLevel, unlockedLevelTitles, xpForNextLevel } from './progression';

describe('level curve', () => {
  it('starts at level 1 with an empty bar', () => {
    assert.deepEqual(levelFromXp(0), { level: 1, currentLevelXp: 0, nextLevelXp: 100, progress: 0 });
  });

  it('carries leftover XP into the next level', () => {
    // 100 (L1→2) + 150 (L2→3) = 250 to reach level 3.
    const progress = levelFromXp(260);
    assert.equal(progress.level, 3);
    assert.equal(progress.currentLevelXp, 10);
    assert.equal(progress.nextLevelXp, xpForNextLevel(3));
  });

  it('ignores negative and fractional input', () => {
    assert.equal(levelFromXp(-50).level, 1);
    assert.equal(levelFromXp(99.9).level, 1);
  });

  it('maps levels to titles', () => {
    assert.equal(titleForLevel(1), 'Rookie');
    assert.equal(titleForLevel(9), 'Contender');
    assert.equal(titleForLevel(10), 'Challenger');
    assert.deepEqual(unlockedLevelTitles(5), ['Rookie', 'Contender']);
  });
});
