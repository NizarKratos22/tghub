'use client';

import type { GameSummary } from '@tgh/shared';
import Link from 'next/link';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useT } from '@/i18n/I18nProvider';
import { GameCover } from './GameCover';
import styles from './GameRail.module.css';

/** Pixels per second: slow enough to read titles as they pass. */
const SPEED = 32;
/** After someone scrolls, swipes or uses the arrows, the rail waits this long before moving again. */
const RESUME_AFTER_MS = 3500;

/**
 * Featured games as one row of small covers that drifts slowly and loops.
 * It stops while pointed at, focused, touched or scrolled by hand, while off
 * screen or in a background tab, and never moves for people who ask for
 * reduced motion. ‹ ⏸ › controls sit next to the title.
 */
export function GameRail({ title, action, games }: { title: string; action: { href: string; label: string }; games: GameSummary[] }) {
  const t = useT();
  const scroller = useRef<HTMLDivElement>(null);
  const copies = useRef<HTMLUListElement[]>([]);
  const hold = useRef({ hover: false, focus: false, offscreen: false, until: 0 });
  const [loops, setLoops] = useState(false);
  const [paused, setPaused] = useState(false);
  const isPaused = useEffectEvent(() => paused);

  useEffect(() => {
    const el = scroller.current;
    const first = copies.current[0];
    if (!el || !first) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Loop only when one set of covers is wider than the rail; otherwise nothing needs to move.
    const measure = () => setLoops(first.scrollWidth > el.clientWidth + 24);
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(el);

    const visible = new IntersectionObserver(([entry]) => {
      hold.current.offscreen = !entry?.isIntersecting;
    });
    visible.observe(el);

    let frame = 0;
    let last = performance.now();
    let position = el.scrollLeft;
    const step = (now: number) => {
      const elapsed = Math.min(64, now - last);
      last = now;
      const second = copies.current[1];
      // In right-to-left pages scrollLeft runs from 0 down to negative values.
      const sign = getComputedStyle(el).direction === 'rtl' ? -1 : 1;
      const span = second ? Math.abs(second.getBoundingClientRect().left - first.getBoundingClientRect().left) : 0;
      const h = hold.current;
      const moving = span > 0 && !isPaused() && !reduce.matches && !document.hidden && !h.hover && !h.focus && !h.offscreen && now > h.until;
      if (moving) {
        position += (sign * SPEED * elapsed) / 1000;
        if (Math.abs(position) >= span) position -= sign * span;
        el.scrollLeft = position;
      } else {
        position = el.scrollLeft;
        // A hand scroll past the first set jumps back invisibly, so the loop never runs out.
        if (span > 0 && Math.abs(position) >= span) el.scrollLeft = position -= sign * span;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);

    const touched = () => (hold.current.until = performance.now() + RESUME_AFTER_MS);
    el.addEventListener('wheel', touched, { passive: true });
    el.addEventListener('touchstart', touched, { passive: true });
    el.addEventListener('pointerdown', touched);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      visible.disconnect();
      el.removeEventListener('wheel', touched);
      el.removeEventListener('touchstart', touched);
      el.removeEventListener('pointerdown', touched);
    };
  }, [games.length]);

  const page = (direction: 1 | -1) => {
    const el = scroller.current;
    const first = copies.current[0];
    const second = copies.current[1];
    if (!el) return;
    hold.current.until = performance.now() + RESUME_AFTER_MS;
    const sign = getComputedStyle(el).direction === 'rtl' ? -1 : 1;
    // Going back from the very start: hop to the same spot in the second set first, so there is room.
    if (direction === -1 && loops && first && second && Math.abs(el.scrollLeft) < el.clientWidth) {
      el.scrollLeft += sign * Math.abs(second.getBoundingClientRect().left - first.getBoundingClientRect().left);
    }
    el.scrollBy({ left: sign * direction * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  const sets = loops ? [0, 1] : [0];

  return (
    <section>
      <SectionHeader title={title}>
        <div className={styles.end}>
          <div className={styles.controls}>
            <button type="button" className={styles.control} onClick={() => page(-1)} aria-label={t.home.railPrev}>
              <Icon name="chevronLeft" size={18} />
            </button>
            {loops ? (
              <button type="button" className={styles.control} onClick={() => setPaused((value) => !value)} aria-pressed={paused} aria-label={paused ? t.home.railPlay : t.home.railPause}>
                <Icon name={paused ? 'play' : 'pause'} size={16} filled={paused} />
              </button>
            ) : null}
            <button type="button" className={styles.control} onClick={() => page(1)} aria-label={t.home.railNext}>
              <Icon name="chevronRight" size={18} />
            </button>
          </div>
          <Link href={action.href} className={styles.action}>
            {action.label}
            <Icon name="chevronRight" size={16} />
          </Link>
        </div>
      </SectionHeader>
      <div
        ref={scroller}
        className={styles.rail}
        onPointerEnter={(event) => event.pointerType === 'mouse' && (hold.current.hover = true)}
        onPointerLeave={() => (hold.current.hover = false)}
        onFocus={() => (hold.current.focus = true)}
        onBlur={() => (hold.current.focus = false)}
      >
        {sets.map((set) => (
          <ul
            key={set}
            ref={(node) => {
              if (node) copies.current[set] = node;
              else copies.current.length = set;
            }}
            className={styles.set}
            // The second set only exists to make the loop seamless: hidden from screen readers and the Tab key.
            aria-hidden={set === 1 || undefined}
            inert={set === 1 || undefined}
          >
            {games.map((game) => (
              <li key={game.id} className={styles.item}>
                <GameCover game={game} size="sm" />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  );
}
