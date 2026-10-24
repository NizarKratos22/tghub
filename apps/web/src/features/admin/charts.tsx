'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import styles from './charts.module.css';

/* ───────────── Shared helpers ───────────── */

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat('en');
const dayLabel = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export const formatCompact = (value: number) => (Math.abs(value) >= 1000 ? compact.format(value) : full.format(value));
export const formatFull = (value: number) => full.format(value);
/** "2026-10-24" → "24 Oct". Day keys are already Tunis-local dates. */
export const formatDay = (day: string) => dayLabel.format(new Date(`${day}T12:00:00Z`));

/** Clean axis ticks: steps of 1, 2 or 5 × 10ⁿ, four-ish of them, from zero. */
export function niceTicks(max: number, target = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / target;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? 10 * power;
  const top = Math.max(step, Math.ceil(max / step) * step);
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry!.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Positioned inside the chart box; values lead, labels follow. */
function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const flip = x > width / 2;
  return (
    <div className={styles.tooltip} style={{ top: y, left: flip ? undefined : x + 14, right: flip ? width - x + 14 : undefined }} role="status">
      {children}
    </div>
  );
}

/* ───────────── Sparkline ───────────── */

/** Recessive trend for stat tiles: grey line, the latest point in the accent. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const W = 120;
  const H = 34;
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const x = (i: number) => 2 + (i * (W - 6)) / (values.length - 1);
  const y = (v: number) => H - 4 - (v / max) * (H - 8);
  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = values.length - 1;
  return (
    <svg className={styles.spark} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <polyline points={points} className={styles.sparkLine} />
      <circle cx={x(last)} cy={y(values[last]!)} r={3.5} className={styles.sparkDot} />
    </svg>
  );
}

/* ───────────── Multi-line chart ───────────── */

export interface LineSeries {
  key: string;
  label: string;
  /** A CSS colour or custom property, e.g. var(--series-1). */
  color: string;
  values: number[];
}

/**
 * Trend over time on one axis. Crosshair snaps to the nearest day; the tooltip
 * lists every series. End labels appear only when they don't collide.
 */
export function LineChart({ days, series, height = 260, label }: { days: string[]; series: LineSeries[]; height?: number; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const n = days.length;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const ticks = niceTicks(max);
  const top = ticks.at(-1)!;

  const pad = { left: 40, right: 16, top: 12, bottom: 28 };
  const innerH = height - pad.top - pad.bottom;
  const y = (v: number) => pad.top + innerH * (1 - v / top);

  // End labels: only if every pair sits at least 14px apart at the right edge.
  const ends = series.map((s) => ({ s, y: y(s.values[n - 1] ?? 0) })).sort((a, b) => a.y - b.y);
  const endLabels = width > 520 && ends.every((end, i) => i === 0 || end.y - ends[i - 1]!.y >= 14);
  const rightPad = endLabels ? 96 : pad.right;
  const plotRight = width - rightPad;
  const xs = (i: number) => pad.left + (n > 1 ? (i * (plotRight - pad.left)) / (n - 1) : (plotRight - pad.left) / 2);

  const pick = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    setActive(Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1)))));
  };
  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    setActive((current) => {
      const start = current ?? n - 1;
      return Math.max(0, Math.min(n - 1, start + (event.key === 'ArrowRight' ? 1 : -1)));
    });
  };

  const tickDays = n <= 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <div
      ref={ref}
      className={styles.chartBox}
      tabIndex={0}
      onKeyDown={onKey}
      onBlur={() => setActive(null)}
      aria-label={`${label}. Use the left and right arrow keys to read each day.`}
    >
      {width > 0 ? (
        <svg width={width} height={height} className={styles.svg} aria-hidden>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={pad.left} x2={plotRight} y1={y(tick)} y2={y(tick)} className={styles.grid} />
              <text x={pad.left - 8} y={y(tick)} className={styles.axisY}>
                {formatCompact(tick)}
              </text>
            </g>
          ))}
          {tickDays.map((i) => (
            <text key={i} x={xs(i)} y={height - 8} className={styles.axisX} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
              {formatDay(days[i]!)}
            </text>
          ))}
          {series.map((s) => (
            <polyline key={s.key} points={s.values.map((v, i) => `${xs(i)},${y(v)}`).join(' ')} className={styles.line} style={{ stroke: s.color }} />
          ))}
          {series.map((s) => (
            <circle key={`end-${s.key}`} cx={xs(n - 1)} cy={y(s.values[n - 1] ?? 0)} r={4} className={styles.dot} style={{ fill: s.color }} />
          ))}
          {endLabels
            ? series.map((s) => (
                <text key={`label-${s.key}`} x={xs(n - 1) + 10} y={y(s.values[n - 1] ?? 0)} className={styles.endLabel}>
                  <tspan className={styles.endValue}>{formatCompact(s.values[n - 1] ?? 0)}</tspan> {s.label}
                </text>
              ))
            : null}
          {active !== null ? (
            <g>
              <line x1={xs(active)} x2={xs(active)} y1={pad.top} y2={pad.top + innerH} className={styles.crosshair} />
              {series.map((s) => (
                <circle key={`hover-${s.key}`} cx={xs(active)} cy={y(s.values[active] ?? 0)} r={4} className={styles.dot} style={{ fill: s.color }} />
              ))}
            </g>
          ) : null}
          <rect
            x={pad.left}
            y={pad.top}
            width={Math.max(0, plotRight - pad.left)}
            height={innerH}
            className={styles.hit}
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      {active !== null && width > 0 ? (
        <Tooltip x={xs(active)} y={pad.top} width={width}>
          <p className={styles.tipTitle}>{formatDay(days[active]!)}</p>
          {series.map((s) => (
            <p key={s.key} className={styles.tipRow}>
              <span className={styles.tipKey} style={{ background: s.color }} />
              <strong>{formatFull(s.values[active] ?? 0)}</strong>
              <span>{s.label}</span>
            </p>
          ))}
        </Tooltip>
      ) : null}
    </div>
  );
}

/* ───────────── Columns ───────────── */

/** One series per day. Columns cap at 24px; the tallest gets its value on the cap. */
export function ColumnChart({ days, values, height = 220, label, unit, color = 'var(--series-1)' }: { days: string[]; values: number[]; height?: number; label: string; unit: string; color?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const n = values.length;
  const ticks = niceTicks(Math.max(1, ...values));
  const top = ticks.at(-1)!;
  const pad = { left: 40, right: 8, top: 22, bottom: 28 };
  const innerW = Math.max(0, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const slot = n > 0 ? innerW / n : 0;
  const barW = Math.max(2, Math.min(24, slot - 2));
  const y = (v: number) => pad.top + innerH * (1 - v / top);
  const peak = values.reduce((best, v, i) => (v > (values[best] ?? -1) ? i : best), 0);
  const tickDays = n <= 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];

  /** Rounded data-end, square at the baseline. */
  const column = (i: number, v: number) => {
    const x0 = pad.left + i * slot + (slot - barW) / 2;
    const y0 = y(v);
    const base = pad.top + innerH;
    const h = base - y0;
    if (h <= 0) return '';
    const r = Math.min(4, barW / 2, h);
    return `M${x0},${base} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + barW - r} Q${x0 + barW},${y0} ${x0 + barW},${y0 + r} V${base} Z`;
  };

  return (
    <div
      ref={ref}
      className={styles.chartBox}
      tabIndex={0}
      aria-label={`${label}. Use the left and right arrow keys to read each day.`}
      onBlur={() => setActive(null)}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        setActive((current) => Math.max(0, Math.min(n - 1, (current ?? n - 1) + (event.key === 'ArrowRight' ? 1 : -1))));
      }}
    >
      {width > 0 ? (
        <svg width={width} height={height} className={styles.svg} aria-hidden>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className={styles.grid} />
              <text x={pad.left - 8} y={y(tick)} className={styles.axisY}>
                {formatCompact(tick)}
              </text>
            </g>
          ))}
          {values.map((v, i) => (
            <path key={days[i]} d={column(i, v)} style={{ fill: color }} className={cx(styles.column, active !== null && active !== i && styles.columnDim)} />
          ))}
          {values[peak]! > 0 ? (
            <text x={pad.left + peak * slot + slot / 2} y={y(values[peak]!) - 6} className={styles.capLabel}>
              {formatCompact(values[peak]!)}
            </text>
          ) : null}
          {tickDays.map((i) => (
            <text key={i} x={pad.left + i * slot + slot / 2} y={height - 8} className={styles.axisX} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>
              {formatDay(days[i]!)}
            </text>
          ))}
          {values.map((_, i) => (
            <rect
              key={`hit-${days[i]}`}
              x={pad.left + i * slot}
              y={pad.top}
              width={slot}
              height={innerH}
              className={styles.hit}
              onPointerEnter={() => setActive(i)}
              onPointerDown={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
            />
          ))}
        </svg>
      ) : (
        <div style={{ height }} />
      )}
      {active !== null && width > 0 ? (
        <Tooltip x={pad.left + active * slot + slot / 2} y={pad.top} width={width}>
          <p className={styles.tipTitle}>{formatDay(days[active]!)}</p>
          <p className={styles.tipRow}>
            <strong>{formatFull(values[active] ?? 0)}</strong>
            <span>{unit}</span>
          </p>
        </Tooltip>
      ) : null}
    </div>
  );
}

/* ───────────── Horizontal bars ───────────── */

/** Magnitude by category, one colour, value at the tip. */
export function BarList({ rows, color = 'var(--series-1)', label }: { rows: Array<{ key: string; label: string; value: number; href?: string }>; color?: string; label: string }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className={styles.bars} aria-label={label}>
      {rows.map((row) => {
        const inner = (
          <>
            <span className={styles.barLabel}>{row.label}</span>
            <span className={styles.barTrack}>
              <span className={styles.bar} style={{ width: `${Math.max(2, (row.value / max) * 100)}%`, background: color }} />
              <span className={styles.barValue}>{formatFull(row.value)}</span>
            </span>
          </>
        );
        return (
          <li key={row.key}>
            {row.href ? (
              <a href={row.href} className={styles.barRow} aria-label={`${row.label}: ${row.value}`}>
                {inner}
              </a>
            ) : (
              <div className={styles.barRow}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Legend for multi-series charts — line keys mirror the line marks. */
export function Legend({ series }: { series: Array<Pick<LineSeries, 'key' | 'label' | 'color'>> }) {
  return (
    <ul className={styles.legend}>
      {series.map((s) => (
        <li key={s.key}>
          <span className={styles.legendKey} style={{ background: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}
