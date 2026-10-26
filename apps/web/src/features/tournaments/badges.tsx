'use client';

import type { TournamentProvider, TournamentStatus } from '@tgh/shared';
import { useT } from '@/i18n/I18nProvider';
import { cx } from '@/lib/cx';
import { providerLabel } from './display';
import styles from './badges.module.css';

export function TournamentStatusBadge({ status }: { status: TournamentStatus }) {
  const t = useT();
  return (
    <span className={cx(styles.status, styles[`status_${status}`])}>
      {status === 'live' ? <span className={styles.liveDot} aria-hidden /> : null}
      {t.labels.tournamentStatus[status]}
    </span>
  );
}

/** Where the tournament actually lives. Samples are hatched so they never pass for real events. */
export function ProviderBadge({ provider }: { provider: TournamentProvider }) {
  const t = useT();
  return <span className={cx(styles.provider, styles[`provider_${provider}`])}>{providerLabel(provider, t)}</span>;
}
