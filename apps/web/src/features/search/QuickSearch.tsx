'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { NAV_LINKS } from '@/components/layout/nav-links';
import { Icon } from '@/components/ui/Icon';
import { KindPill } from '@/features/radar/RadarCards';
import { fill } from '@/i18n/config';
import { useFormat, useT } from '@/i18n/I18nProvider';
import { api } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { useDebounced } from '@/lib/useDebounced';
import { useOpenForRoute } from '@/lib/useOpenForRoute';
import { isExternal } from '@/lib/format';
import styles from './QuickSearch.module.css';

const RECENT_KEY = 'tgh.recentSearches';
const MAX_RECENT = 5;

function readRecent(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function remember(query: string) {
  try {
    const next = [query, ...readRecent().filter((item) => item.toLowerCase() !== query.toLowerCase())].slice(0, MAX_RECENT);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Private mode: recent searches just aren't kept.
  }
}

/** Typing in a field (or a contenteditable) — where "/" must stay a character. */
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

// The key hint only differs on Apple devices; the server renders the Ctrl version.
const neverChanges = () => () => {};
const platformShortcut = () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘K' : 'Ctrl K');
const serverShortcut = () => 'Ctrl K';

interface Option {
  id: string;
  group: 'jump' | 'recent' | 'games' | 'radar' | 'tournaments' | 'all';
  href: string;
  /** A search to remember when this option is opened. */
  query?: string;
  body: ReactNode;
}

/**
 * Site-wide quick search: Ctrl K / ⌘K or "/" anywhere, or the header button.
 * Suggestions come as you type (not counted as searches for missions); arrow
 * keys move, Enter opens, Esc closes. "See everything" goes to the Radar search.
 */
export function QuickSearch() {
  const t = useT();
  const words = t.quickSearch;
  const format = useFormat();
  const router = useRouter();
  const listId = useId();
  const [open, setOpen] = useOpenForRoute();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const shortcut = useSyncExternalStore(neverChanges, platformShortcut, serverShortcut);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const term = useDebounced(query.trim(), 180);
  // Read when the palette opens; it only changes from inside it, which closes it.
  const recent = useMemo(() => (open ? readRecent() : []), [open]);
  // The highlight goes back to the first option whenever the list itself changes.
  const listKey = `${open}:${term}`;
  const [activeFor, setActiveFor] = useState(listKey);
  if (activeFor !== listKey) {
    setActiveFor(listKey);
    setActive(0);
  }
  const results = useQuery({
    queryKey: ['quick-search', term],
    queryFn: () => api.radar.search(term, { track: false }),
    enabled: open && term.length >= 2,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, [setOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      } else if (event.key === '/' && !event.metaKey && !event.ctrlKey && !isTyping(event.target)) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => input.current?.select());
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = '';
    };
  }, [open]);

  const searching = term.length >= 2;
  // While the next term loads, the previous results stay up instead of flashing empty.
  const data = searching ? results.data : undefined;
  const thumb = (content: ReactNode, style?: CSSProperties) => (
    <span className={styles.thumb} style={style} aria-hidden>
      {content}
    </span>
  );

  const options: Option[] = [];
  if (!searching) {
    for (const item of recent) {
      options.push({
        id: `recent-${item}`,
        group: 'recent',
        href: `/radar?q=${encodeURIComponent(item)}`,
        query: item,
        body: (
          <>
            {thumb(<Icon name="clock" size={16} />)}
            <span className={styles.main}>
              <bdi className={styles.title}>{item}</bdi>
            </span>
          </>
        ),
      });
    }
    for (const link of NAV_LINKS) {
      options.push({
        id: `jump-${link.href}`,
        group: 'jump',
        href: link.href,
        body: (
          <>
            {thumb(<Icon name={link.icon} size={16} />)}
            <span className={styles.main}>
              <span className={styles.title}>{t.nav[link.label]}</span>
            </span>
          </>
        ),
      });
    }
  } else if (data) {
    for (const game of data.games.slice(0, 5)) {
      options.push({
        id: `game-${game.id}`,
        group: 'games',
        href: `/games/${game.slug}`,
        body: (
          <>
            {game.coverUrl
              ? thumb(<img src={game.coverUrl} alt="" loading="lazy" />, { aspectRatio: '3 / 4' })
              : thumb(<span className={styles.monogram}>{game.monogram}</span>, { background: game.accent, color: '#fff' })}
            <span className={styles.main}>
              <bdi className={styles.title}>{game.title}</bdi>
              <span className={styles.meta}>{game.tagline}</span>
            </span>
          </>
        ),
      });
    }
    for (const resource of data.resources.slice(0, 5)) {
      options.push({
        id: `radar-${resource.id}`,
        group: 'radar',
        href: resource.url,
        body: (
          <>
            {resource.image ? thumb(<img src={resource.image.url} alt="" loading="lazy" />, { aspectRatio: '16 / 9' }) : thumb(<Icon name="radar" size={16} />)}
            <span className={styles.main}>
              <bdi className={styles.title}>{resource.title}</bdi>
              <span className={styles.meta}>
                <KindPill kind={resource.kind} />
                {resource.game ? <bdi>{resource.game.title}</bdi> : null}
                <span>{format.date(resource.publishedAt)}</span>
              </span>
            </span>
            {isExternal(resource.url) ? <Icon name="arrowUpRight" size={14} className={styles.out} /> : null}
          </>
        ),
      });
    }
    for (const tournament of data.tournaments.slice(0, 3)) {
      options.push({
        id: `tournament-${tournament.id}`,
        group: 'tournaments',
        href: `/tournaments/${tournament.slug}`,
        body: (
          <>
            {tournament.imageUrl ? thumb(<img src={tournament.imageUrl} alt="" loading="lazy" />) : thumb(<Icon name="trophy" size={16} />)}
            <span className={styles.main}>
              <bdi className={styles.title}>{tournament.name}</bdi>
              <span className={styles.meta}>
                {tournament.game ? <bdi>{tournament.game.title}</bdi> : tournament.gameName ? <bdi>{tournament.gameName}</bdi> : null}
                <span>{format.date(tournament.startsAt)}</span>
              </span>
            </span>
          </>
        ),
      });
    }
  }
  if (searching) {
    options.push({
      id: 'all',
      group: 'all',
      href: `/radar?q=${encodeURIComponent(term)}`,
      query: term,
      body: (
        <>
          {thumb(<Icon name="search" size={16} />)}
          <span className={styles.main}>
            <span className={styles.title}>{fill(words.seeAll, { q: term })}</span>
          </span>
          <Icon name="arrowRight" size={14} className={cx(styles.out, 'dir-flip')} />
        </>
      ),
    });
  }

  const choose = (option: Option | undefined) => {
    if (!option) return;
    if (option.query) remember(option.query);
    // A finished search starts fresh next time (recent searches show); Esc keeps the text instead.
    setQuery('');
    setOpen(false);
    if (isExternal(option.href)) window.open(option.href, '_blank', 'noopener,noreferrer');
    else router.push(option.href);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (options.length === 0) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((index) => (index + step + options.length) % options.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(options[active] ?? options.at(-1));
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      // The field is the dialog's only stop; Tab shouldn't wander to the page behind it.
      event.preventDefault();
    }
  };

  // Keep the highlighted option in view while arrowing through a long list.
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, listId]);

  const groupTitle: Record<Option['group'], string | null> = {
    jump: words.jumpTo,
    recent: words.recent,
    games: words.games,
    radar: words.radar,
    tournaments: words.tournaments,
    all: null,
  };
  const groups = options.reduce<Array<{ group: Option['group']; items: Array<{ option: Option; index: number }> }>>((list, option, index) => {
    const last = list.at(-1);
    if (last?.group === option.group) last.items.push({ option, index });
    else list.push({ group: option.group, items: [{ option, index }] });
    return list;
  }, []);

  const empty = searching && data && options.length === 1;
  const status = !searching ? null : results.isFetching && !data ? words.searching : empty ? fill(words.nothing, { q: term }) : null;

  return (
    <>
      <button ref={trigger} type="button" className={styles.trigger} onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label={words.open}>
        <Icon name="search" size={18} />
        <span className={styles.triggerText}>{words.open}</span>
        <kbd className={styles.triggerKey}>{shortcut}</kbd>
      </button>

      {open
        ? createPortal(
            <div className={styles.overlay} onMouseDown={(event) => event.target === event.currentTarget && close()}>
              <div className={styles.panel} role="dialog" aria-modal="true" aria-label={words.label}>
                <div className={styles.field}>
                  <Icon name="search" size={20} />
                  <input
                    ref={input}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={words.placeholder}
                    role="combobox"
                    aria-expanded="true"
                    aria-controls={listId}
                    aria-activedescendant={options.length ? `${listId}-${active}` : undefined}
                    aria-autocomplete="list"
                    autoComplete="off"
                    spellCheck={false}
                    dir="auto"
                  />
                  {results.isFetching ? <span className={styles.spinner} aria-hidden /> : null}
                  <button type="button" className={styles.esc} onClick={close}>
                    Esc
                  </button>
                </div>

                <div className={styles.list} id={listId} role="listbox" aria-label={words.label}>
                  {status ? (
                    <p className={styles.status} role="status">
                      {status}
                    </p>
                  ) : null}
                  {groups.map(({ group, items }) => (
                    <div key={group} role="group" aria-label={groupTitle[group] ?? undefined} className={styles.group}>
                      {groupTitle[group] ? (
                        <p className={styles.groupTitle} aria-hidden>
                          {groupTitle[group]}
                        </p>
                      ) : null}
                      {items.map(({ option, index }) => (
                        <div
                          key={option.id}
                          id={`${listId}-${index}`}
                          role="option"
                          aria-selected={index === active}
                          className={cx(styles.option, index === active && styles.optionActive)}
                          onMouseMove={() => index !== active && setActive(index)}
                          onClick={() => choose(option)}
                        >
                          {option.body}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                <div className={styles.footer} aria-hidden>
                  <span>
                    <kbd>↑</kbd>
                    <kbd>↓</kbd> {words.hintMove}
                  </span>
                  <span>
                    <kbd>Enter</kbd> {words.hintOpen}
                  </span>
                  <span>
                    <kbd>Esc</kbd> {words.hintClose}
                  </span>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

