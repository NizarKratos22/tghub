'use client';

import type { GameDetail } from '@tgh/shared';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { fill } from '@/i18n/config';
import { useT } from '@/i18n/I18nProvider';
import { cx } from '@/lib/cx';
import styles from './GameMedia.module.css';

/**
 * Trailer and screenshots from IGDB. The trailer is a still until it's
 * clicked, so YouTube (in its no-cookie mode) only loads for players who want it.
 */
export function GameMedia({ title, screenshots, videos }: { title: string; screenshots: GameDetail['screenshots']; videos: string[] }) {
  const t = useT();
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const trailer = videos[0];
  const total = screenshots.length;

  return (
    <div className={cx(styles.media, !trailer && styles.noTrailer)}>
      {trailer ? (
        <div className={styles.video}>
          {playing ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${trailer}?autoplay=1&rel=0`}
              title={fill(t.games.trailerTitle, { game: title })}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              className={styles.poster}
              style={{ backgroundImage: `url(https://i.ytimg.com/vi/${trailer}/hqdefault.jpg)` }}
              onClick={() => setPlaying(true)}
              aria-label={t.games.playTrailer}
            >
              <span className={styles.play}>
                <Icon name="play" size={26} filled />
              </span>
            </button>
          )}
        </div>
      ) : null}
      {total > 0 ? (
        <ul className={styles.shots}>
          {screenshots.map((shot, index) => (
            <li key={shot.url}>
              <button type="button" className={styles.shot} onClick={() => setOpen(index)}>
                <img src={shot.thumbUrl} alt={fill(t.games.screenshot, { n: index + 1, total })} loading="lazy" decoding="async" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open !== null ? <Viewer screenshots={screenshots} start={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

function Viewer({ screenshots, start, onClose }: { screenshots: GameDetail['screenshots']; start: number; onClose: () => void }) {
  const t = useT();
  const [index, setIndex] = useState(start);
  const close = useRef<HTMLButtonElement>(null);
  const total = screenshots.length;
  const go = (step: number) => setIndex((current) => (current + step + total) % total);
  const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';

  const handleKey = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape') onClose();
    // Arrow keys follow the page direction: "next" is to the left in Arabic.
    if (event.key === 'ArrowRight') go(rtl ? -1 : 1);
    if (event.key === 'ArrowLeft') go(rtl ? 1 : -1);
  });

  useEffect(() => {
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => handleKey(event);
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  const shot = screenshots[index]!;
  return (
    <div className={styles.viewer} role="dialog" aria-modal="true" aria-label={fill(t.games.screenshot, { n: index + 1, total })} onClick={onClose}>
      <img key={shot.url} src={shot.url} alt={fill(t.games.screenshot, { n: index + 1, total })} className={styles.full} onClick={(event) => event.stopPropagation()} />
      <button type="button" ref={close} className={cx(styles.control, styles.closeButton)} onClick={onClose} aria-label={t.games.close}>
        <Icon name="close" size={22} />
      </button>
      {total > 1 ? (
        <>
          <button type="button" className={cx(styles.control, styles.prev)} onClick={(event) => (event.stopPropagation(), go(-1))} aria-label={t.games.previous}>
            <Icon name="chevronLeft" size={26} />
          </button>
          <button type="button" className={cx(styles.control, styles.next)} onClick={(event) => (event.stopPropagation(), go(1))} aria-label={t.games.next}>
            <Icon name="chevronRight" size={26} />
          </button>
          <span className={styles.counter}>
            {index + 1} / {total}
          </span>
        </>
      ) : null}
    </div>
  );
}
