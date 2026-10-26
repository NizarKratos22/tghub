'use client';

import Link from 'next/link';
import type { GameSummary, Platform } from '@tgh/shared';
import type { CSSProperties } from 'react';
import { useT } from '@/i18n/I18nProvider';
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
 * The game's IGDB box art; without one, typographic key art on the game's own
 * colour (monogram, genre and platforms) keeps the catalogue consistent.
 */
export function GameCover({ game, link = true, size = 'md', className }: { game: CoverGame; link?: boolean; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const t = useT();
  const length = game.monogram.replace(/\s/g, '').length;
  const monogramSize = length <= 2 ? styles.mono2 : length === 3 ? styles.mono3 : styles.mono4;
  const genre = game.genres[0];

  const content = (
    <>
      <span className={styles.art}>
        {game.coverUrl ? (
          // Box art from IGDB's CDN: already sized, cached for a year.
          <img src={game.coverUrl} alt="" className={styles.image} loading="lazy" decoding="async" />
        ) : (
          <span className={cx(styles.monogram, monogramSize)} aria-hidden>
            {game.monogram}
          </span>
        )}
        <span className={styles.chips}>
          <span className={styles.chip}>{genre ? t.labels.genre[genre] : t.games.game}</span>
          {game.freeToPlay ? <span className={cx(styles.chip, styles.f2p)}>{t.games.free}</span> : null}
        </span>
      </span>
      <span className={styles.body}>
        <span className={styles.title}>{game.title}</span>
        <span className={styles.platforms}>{game.platforms.map((p) => PLATFORM_SHORT[p]).join(' · ')}</span>
      </span>
    </>
  );

  const props = {
    className: cx(styles.cover, size === 'lg' && styles.large, size === 'sm' && styles.small, className),
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

/** `columns="auto"` fits as many ~200 px covers as the width allows (the catalogue); 4 or 5 is a fixed count. */
export function GameGrid({ games, columns = 5 }: { games: GameSummary[]; columns?: 4 | 5 | 'auto' }) {
  return (
    <ul className={cx(styles.grid, columns === 4 && styles.grid4, columns === 'auto' && styles.gridAuto)}>
      {games.map((game) => (
        <li key={game.id}>
          <GameCover game={game} />
        </li>
      ))}
    </ul>
  );
}
