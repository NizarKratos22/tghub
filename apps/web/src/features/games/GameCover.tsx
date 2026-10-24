import Link from 'next/link';
import { GENRE_LABELS, type GameSummary, type Platform } from '@tgh/shared';
import type { CSSProperties } from 'react';
import { cx } from '@/lib/cx';
import styles from './GameCover.module.css';

const PLATFORM_SHORT: Record<Platform, string> = {
  pc: 'PC',
  playstation: 'PS',
  xbox: 'XB',
  switch: 'NS',
  mobile: 'MOB',
};

type CoverGame = Pick<GameSummary, 'slug' | 'title' | 'monogram' | 'accent' | 'genres' | 'platforms' | 'freeToPlay' | 'coverUrl'>;

/**
 * Typographic key art on the game's own colour: monogram, genre and platforms —
 * consistent across the catalogue and independent of licensed artwork.
 */
export function GameCover({ game, link = true, size = 'md', className }: { game: CoverGame; link?: boolean; size?: 'md' | 'lg'; className?: string }) {
  const length = game.monogram.replace(/\s/g, '').length;
  const monogramSize = length <= 2 ? styles.mono2 : length === 3 ? styles.mono3 : styles.mono4;
  const genre = game.genres[0];

  const content = (
    <>
      <span className={styles.art}>
        {game.coverUrl ? <span className={styles.image} style={{ backgroundImage: `url(${game.coverUrl})` }} aria-hidden /> : null}
        <span className={cx(styles.monogram, monogramSize)} aria-hidden>
          {game.monogram}
        </span>
        <span className={styles.chips}>
          <span className={styles.chip}>{genre ? GENRE_LABELS[genre] : 'Game'}</span>
          {game.freeToPlay ? <span className={cx(styles.chip, styles.f2p)}>Free</span> : null}
        </span>
      </span>
      <span className={styles.body}>
        <span className={styles.title}>{game.title}</span>
        <span className={styles.platforms}>{game.platforms.map((p) => PLATFORM_SHORT[p]).join(' · ')}</span>
      </span>
    </>
  );

  const props = {
    className: cx(styles.cover, size === 'lg' && styles.large, className),
    style: { '--accent': game.accent } as CSSProperties,
  };

  return link ? (
    <Link href={`/games/${game.slug}`} {...props}>
      {content}
    </Link>
  ) : (
    <div {...props}>{content}</div>
  );
}

export function GameGrid({ games, columns = 5 }: { games: GameSummary[]; columns?: 4 | 5 }) {
  return (
    <ul className={cx(styles.grid, columns === 4 && styles.grid4)}>
      {games.map((game) => (
        <li key={game.id}>
          <GameCover game={game} />
        </li>
      ))}
    </ul>
  );
}
