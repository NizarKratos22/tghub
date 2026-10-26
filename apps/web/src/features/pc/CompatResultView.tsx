'use client';

import Link from 'next/link';
import type { CompatResult } from '@tgh/shared';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge } from '@/components/ui/primitives';
import { fill } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import { useFormat, useT } from '@/i18n/I18nProvider';
import { cx } from '@/lib/cx';
import type { Format } from '@/lib/format';
import styles from './CompatResultView.module.css';

const VERDICT_TONE: Record<CompatResult['overall'], string> = {
  recommended: styles.toneRec!,
  minimum: styles.toneMin!,
  below: styles.toneBelow!,
  unknown: styles.toneUnknown!,
};

/** The verdict in the player's language, from the same facts the engine used. */
function verdictWords(result: CompatResult, t: Dictionary, format: Format): { headline: string; detail: string } {
  const headline = t.pc.headline[result.overall];
  switch (result.overall) {
    case 'recommended':
      return { headline, detail: result.singleTier ? t.pc.detailSingleTier : t.pc.detailRecommended };
    case 'minimum':
      return { headline, detail: result.bottleneck ? fill(t.pc.detailMinimumPart, { part: t.pc.parts[result.bottleneck] }) : t.pc.detailMinimum };
    case 'below': {
      const failing = result.dimensions.filter((d) => d.status === 'below').map((d) => t.pc.parts[d.key]);
      return { headline, detail: format.fill(t.pc.detailBelow, { parts: format.list(failing), count: failing.length }) };
    }
    default:
      return { headline, detail: t.pc.detailUnknown };
  }
}

function RatioBar({ ratio }: { ratio: number | null }) {
  const t = useT();
  if (ratio === null) return <span className={styles.ratioNone}>—</span>;
  // The reference tier sits at 50% of the track; 2× the requirement fills it.
  const filled = Math.min(1, ratio / 2) * 100;
  return (
    <span className={styles.ratio} title={fill(t.pc.ofReference, { percent: Math.round(ratio * 100) })}>
      <span className={styles.ratioTrack}>
        <span className={cx(styles.ratioFill, ratio < 1 && styles.ratioLow)} style={{ width: `${filled}%` }} />
        <span className={styles.ratioMark} />
      </span>
      <span className={styles.ratioValue}>{ratio >= 1 ? `+${Math.round((ratio - 1) * 100)}%` : `−${Math.round((1 - ratio) * 100)}%`}</span>
    </span>
  );
}

export function CompatResultView({ result, compact = false }: { result: CompatResult; compact?: boolean }) {
  const t = useT();
  const format = useFormat();
  const { headline, detail } = verdictWords(result, t, format);
  // Sizes arrive as "16 GB"; the unit is written the local way ("16 Go").
  const value = (text: string | null) => (text === null ? '—' : text === 'Shared' ? t.pc.shared : text.replace(/^(\d+) GB$/, (_, n: string) => fill(t.pc.gbValue, { value: n })));
  const upgradeNote = result.upgradeNoteKind ? t.pc.upgradeNote[result.upgradeNoteKind] : null;
  return (
    <div className={styles.result}>
      <div className={cx(styles.verdict, VERDICT_TONE[result.overall])}>
        <div>
          <p className={styles.verdictGame}>{result.game.title}</p>
          <p className={styles.headline}>{headline}</p>
          <p className={styles.detail}>{detail}</p>
        </div>
        <span className={styles.badgeSlot}>
          <StatusBadge status={result.overall} />
        </span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t.pc.table.part}</th>
              <th scope="col">{t.pc.table.yourRig}</th>
              {!compact ? <th scope="col">{t.pc.table.minimum}</th> : null}
              {!compact ? <th scope="col">{t.pc.table.recommended}</th> : null}
              <th scope="col">{t.pc.table.headroom}</th>
              <th scope="col">{t.pc.table.verdict}</th>
            </tr>
          </thead>
          <tbody>
            {result.dimensions.map((dimension) => (
              <tr key={dimension.key} className={cx(result.bottleneck === dimension.key && styles.bottleneck)}>
                <th scope="row">{t.pc.dimension[dimension.key]}</th>
                <td className={styles.have}>{value(dimension.have)}</td>
                {!compact ? <td className={styles.req}>{value(dimension.minimum)}</td> : null}
                {!compact ? <td className={styles.req}>{value(dimension.recommended)}</td> : null}
                <td>
                  <RatioBar ratio={dimension.ratio} />
                </td>
                <td>
                  <StatusBadge status={dimension.status} size="sm" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.upgrades.length > 0 || result.ramTargetGb || upgradeNote ? (
        <div className={styles.upgrades}>
          <p className={styles.upgradesTitle}>{t.pc.upgradePointers}</p>
          {result.upgrades.map((upgrade) => (
            <p key={upgrade.key} className={styles.upgrade}>
              <strong>{t.pc.upgradeLead[upgrade.key]}</strong> {fill(t.pc.upgradeText, { tier: t.pc.tier[upgrade.target] })}{' '}
              {upgrade.options.map((option, index) => (
                <span key={option.id}>
                  {index > 0 ? t.common.comma : ''}
                  <span className={styles.part}>
                    {option.brand} {option.model}
                  </span>
                </span>
              ))}
              .
            </p>
          ))}
          {result.ramTargetGb ? (
            <p className={styles.upgrade}>
              <strong>{t.pc.memoryLead}</strong> {fill(t.pc.ramAdvice, { gb: result.ramTargetGb })}
            </p>
          ) : null}
          {upgradeNote ? <p className={styles.upgrade}>{upgradeNote}</p> : null}
          {result.upgrades.length > 0 ? <p className={styles.note}>{t.pc.pricesNote}</p> : null}
        </div>
      ) : null}

      {result.confidence !== 'full' ? (
        <p className={styles.note}>{t.pc.partialNote}</p>
      ) : null}
      {compact ? (
        <Link href={`/pc?game=${result.game.slug}`} className={styles.more}>
          {t.pc.fullBreakdown} <Icon name="arrowRight" size={14} />
        </Link>
      ) : null}
    </div>
  );
}
