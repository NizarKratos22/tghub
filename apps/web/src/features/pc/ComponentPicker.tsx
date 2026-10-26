'use client';

import {
  COMPONENT_BRANDS,
  type ComponentBrand,
  type ComponentSegment,
  type ComponentType,
  type HardwareComponent,
} from '@tgh/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Fragment, useEffect, useId, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { fill } from '@/i18n/config';
import { useFormat, useT } from '@/i18n/I18nProvider';
import { api } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import styles from './ComponentPicker.module.css';

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

const SEGMENTS: Record<ComponentType, ComponentSegment[]> = {
  cpu: ['desktop', 'laptop'],
  gpu: ['desktop', 'laptop', 'integrated'],
};
const BRANDS: Record<ComponentType, readonly ComponentBrand[]> = {
  cpu: ['AMD', 'Intel'],
  gpu: COMPONENT_BRANDS,
};
const BROWSE_LIMIT = 80;

interface ComponentPickerProps {
  type: ComponentType;
  label: string;
  value: HardwareComponent | null;
  onChange: (component: HardwareComponent) => void;
  placeholder: string;
}

const groupKey = (component: HardwareComponent) => `${component.brand} · ${component.series}`;

/** Groups by series (fastest series first), fastest part first inside each group. */
function groupBySeries(list: HardwareComponent[]): HardwareComponent[] {
  const rank = new Map<string, number>();
  for (const component of list) if (!rank.has(groupKey(component))) rank.set(groupKey(component), rank.size);
  return [...list].sort((a, b) => rank.get(groupKey(a))! - rank.get(groupKey(b))! || b.score - a.score);
}

/** Keeps focus in the input so the list stays open while a filter is toggled. */
const keepFocus = (event: MouseEvent) => event.preventDefault();

/**
 * Searchable combobox over the hardware index (ARIA 1.2 pattern). With no text
 * it becomes a browser: every part matching the filters, grouped by series.
 */
export function ComponentPicker({ type, label, value, onChange, placeholder }: ComponentPickerProps) {
  const t = useT();
  const format = useFormat();
  const id = useId();
  const [editing, setEditing] = useState(!value);
  const [text, setText] = useState('');
  const [brand, setBrand] = useState<ComponentBrand | undefined>();
  const [segment, setSegment] = useState<ComponentSegment | undefined>();
  const [highlight, setHighlight] = useState(0);
  const [open, setOpen] = useState(false);
  const term = useDebounced(text, 180);

  const results = useQuery({
    queryKey: ['pc', 'components', type, term, brand, segment],
    queryFn: () => api.pc.components(type, { q: term || undefined, brand, segment, limit: term ? 30 : BROWSE_LIMIT }),
    enabled: editing && open,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
  const browsing = !term;
  const options = useMemo(() => {
    const list = results.data ?? [];
    return browsing ? groupBySeries(list) : list;
  }, [results.data, browsing]);

  // A new search or filter starts the highlight from the top again.
  const filterKey = `${term}|${brand ?? ''}|${segment ?? ''}`;
  const [highlightFor, setHighlightFor] = useState(filterKey);
  if (highlightFor !== filterKey) {
    setHighlightFor(filterKey);
    setHighlight(0);
  }
  // A part picked here or from outside (a detected PC, a shared link) closes the search.
  const [shownValue, setShownValue] = useState(value);
  if (shownValue !== value) {
    setShownValue(value);
    if (value) setEditing(false);
  }

  const choose = (component: HardwareComponent) => {
    onChange(component);
    setText('');
    setOpen(false);
    setEditing(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = options[highlight];
      if (option) choose(option);
    } else if (event.key === 'Escape') {
      setOpen(false);
      if (value) setEditing(false);
    }
  };

  const maxScore = type === 'gpu' ? 40_000 : 67_500;

  return (
    <div className={styles.picker}>
      <label htmlFor={`${id}-input`} className="label">
        {label}
      </label>

      {!editing && value ? (
        <button type="button" className={styles.selected} onClick={() => setEditing(true)}>
          <span className={styles.selectedText}>
            <span className={styles.brand}>
              {value.brand} · {t.labels.componentSegment[value.segment]}
            </span>
            <span className={styles.model}>{value.model}</span>
          </span>
          <span className={styles.score} title={t.pc.perfIndex}>
            <span className={styles.scoreBar}>
              <span style={{ width: `${Math.min(100, (value.score / maxScore) * 100)}%` }} />
            </span>
            <span className="mono">{format.number(value.score)}</span>
          </span>
          <span className={styles.change}>{t.pc.change}</span>
        </button>
      ) : (
        <>
          <div className={styles.filters} role="group" aria-label={fill(t.pc.filters, { label })}>
            <span className={styles.filterSet}>
              {BRANDS[type].map((item) => (
                <button
                  key={item}
                  type="button"
                  className={cx(styles.filter, brand === item && styles.filterOn)}
                  aria-pressed={brand === item}
                  onMouseDown={keepFocus}
                  onClick={() => {
                    setBrand(brand === item ? undefined : item);
                    setOpen(true);
                  }}
                >
                  {item}
                </button>
              ))}
            </span>
            <span className={styles.filterSet}>
              {SEGMENTS[type].map((item) => (
                <button
                  key={item}
                  type="button"
                  className={cx(styles.filter, segment === item && styles.filterOn)}
                  aria-pressed={segment === item}
                  onMouseDown={keepFocus}
                  onClick={() => {
                    setSegment(segment === item ? undefined : item);
                    setOpen(true);
                  }}
                >
                  {t.labels.componentSegment[item]}
                </button>
              ))}
            </span>
          </div>
          <div className={styles.combo}>
            <Icon name="search" size={16} />
            <input
              id={`${id}-input`}
              role="combobox"
              aria-expanded={open && options.length > 0}
              aria-controls={`${id}-list`}
              aria-activedescendant={options[highlight] ? `${id}-opt-${options[highlight]!.id}` : undefined}
              aria-autocomplete="list"
              autoComplete="off"
              value={text}
              placeholder={placeholder}
              onChange={(event) => {
                setText(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onKeyDown={onKeyDown}
              autoFocus={Boolean(value)}
            />
            {value ? (
              <button type="button" className={styles.cancel} onClick={() => setEditing(false)} aria-label={t.pc.keepCurrent}>
                <Icon name="close" size={14} />
              </button>
            ) : null}
          </div>
        </>
      )}

      {editing && open ? (
        <ul id={`${id}-list`} role="listbox" aria-label={fill(t.pc.results, { label })} className={styles.list}>
          {options.map((option, index) => (
            <Fragment key={option.id}>
              {browsing && (index === 0 || groupKey(option) !== groupKey(options[index - 1]!)) ? (
                <li role="presentation" className={styles.group}>
                  {groupKey(option)}
                </li>
              ) : null}
              <li
                id={`${id}-opt-${option.id}`}
                role="option"
                aria-selected={index === highlight}
                className={cx(styles.option, index === highlight && styles.highlight)}
                onMouseEnter={() => setHighlight(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(option);
                }}
              >
                <span>
                  {browsing ? null : <span className={styles.optionBrand}>{option.brand} </span>}
                  {option.model}
                </span>
                <span className={styles.optionMeta}>
                  {option.segment !== 'desktop' ? `${t.labels.componentSegment[option.segment]} · ` : ''}
                  {option.vramGb ? `${fill(t.pc.gbValue, { value: option.vramGb })} · ` : ''}
                  {option.releaseYear ?? ''}
                </span>
              </li>
            </Fragment>
          ))}
          {results.isSuccess && options.length === 0 ? (
            <li className={styles.none}>{t.pc.noMatch}</li>
          ) : null}
          {browsing && options.length >= BROWSE_LIMIT ? (
            <li className={styles.none}>{fill(t.pc.showingFastest, { count: BROWSE_LIMIT })}</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
