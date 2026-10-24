import { TOURNAMENT_STATUS_LABELS, type TournamentProvider, type TournamentStatus } from '@tgh/shared';
import { cx } from '@/lib/cx';
import { providerLabel } from './display';
import styles from './badges.module.css';

export function TournamentStatusBadge({ status }: { status: TournamentStatus }) {
  return (
    <span className={cx(styles.status, styles[`status_${status}`])}>
      {status === 'live' ? <span className={styles.liveDot} aria-hidden /> : null}
      {TOURNAMENT_STATUS_LABELS[status]}
    </span>
  );
}

/** Where the tournament actually lives. Samples are hatched so they never pass for real events. */
export function ProviderBadge({ provider }: { provider: TournamentProvider }) {
  return <span className={cx(styles.provider, styles[`provider_${provider}`])}>{providerLabel(provider)}</span>;
}
