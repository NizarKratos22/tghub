import Link from 'next/link';
import type { CompatResult } from '@tgh/shared';
import { StatusBadge } from '@/components/ui/primitives';
import { cx } from '@/lib/cx';
import styles from './CompatResultView.module.css';

const VERDICT_TONE: Record<CompatResult['overall'], string> = {
  recommended: styles.toneRec!,
  minimum: styles.toneMin!,
  below: styles.toneBelow!,
  unknown: styles.toneUnknown!,
};

function RatioBar({ ratio }: { ratio: number | null }) {
  if (ratio === null) return <span className={styles.ratioNone}>—</span>;
  // The reference tier sits at 50% of the track; 2× the requirement fills it.
  const fill = Math.min(1, ratio / 2) * 100;
  return (
    <span className={styles.ratio} title={`${Math.round(ratio * 100)}% of the reference spec`}>
      <span className={styles.ratioTrack}>
        <span className={cx(styles.ratioFill, ratio < 1 && styles.ratioLow)} style={{ width: `${fill}%` }} />
        <span className={styles.ratioMark} />
      </span>
      <span className={styles.ratioValue}>{ratio >= 1 ? `+${Math.round((ratio - 1) * 100)}%` : `−${Math.round((1 - ratio) * 100)}%`}</span>
    </span>
  );
}

export function CompatResultView({ result, compact = false }: { result: CompatResult; compact?: boolean }) {
  return (
    <div className={styles.result}>
      <div className={cx(styles.verdict, VERDICT_TONE[result.overall])}>
        <div>
          <p className={styles.verdictGame}>{result.game.title}</p>
          <p className={styles.headline}>{result.headline}</p>
          <p className={styles.detail}>{result.detail}</p>
        </div>
        <span className={styles.badgeSlot}>
          <StatusBadge status={result.overall} />
        </span>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Part</th>
              <th scope="col">Your rig</th>
              {!compact ? <th scope="col">Minimum</th> : null}
              {!compact ? <th scope="col">Recommended</th> : null}
              <th scope="col">Headroom</th>
              <th scope="col">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {result.dimensions.map((dimension) => (
              <tr key={dimension.key} className={cx(result.bottleneck === dimension.key && styles.bottleneck)}>
                <th scope="row">{dimension.label}</th>
                <td className={styles.have}>{dimension.have}</td>
                {!compact ? <td className={styles.req}>{dimension.minimum ?? '—'}</td> : null}
                {!compact ? <td className={styles.req}>{dimension.recommended ?? '—'}</td> : null}
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

      {result.upgrades.length > 0 || result.ramAdvice || result.upgradeNote ? (
        <div className={styles.upgrades}>
          <p className={styles.upgradesTitle}>Upgrade pointers</p>
          {result.upgrades.map((upgrade) => (
            <p key={upgrade.key} className={styles.upgrade}>
              <strong>{upgrade.key === 'gpu' ? 'Graphics' : 'Processor'}</strong> — the lightest parts in our index that reach the {upgrade.target} tier:{' '}
              {upgrade.options.map((option, index) => (
                <span key={option.id}>
                  {index > 0 ? ', ' : ''}
                  <span className={styles.part}>
                    {option.brand} {option.model}
                  </span>
                </span>
              ))}
              .
            </p>
          ))}
          {result.ramAdvice ? (
            <p className={styles.upgrade}>
              <strong>Memory</strong> — {result.ramAdvice}
            </p>
          ) : null}
          {result.upgradeNote ? <p className={styles.upgrade}>{result.upgradeNote}</p> : null}
          {result.upgrades.length > 0 ? <p className={styles.note}>Local TND prices appear once we have a dated source for them.</p> : null}
        </div>
      ) : null}

      {result.confidence !== 'full' ? (
        <p className={styles.note}>Some parts couldn&apos;t be matched to benchmark data, so parts of this verdict are marked “No data”.</p>
      ) : null}
      {compact ? (
        <Link href={`/pc?game=${result.game.slug}`} className={styles.more}>
          Full breakdown in PC Lab →
        </Link>
      ) : null}
    </div>
  );
}
