import type { AlertChannelName } from '@tgh/shared';
import type { AlertDoc } from '../alerts.model';

export interface DeliveryOutcome {
  status: 'sent' | 'skipped' | 'failed';
  recipients: number;
  detail: string | null;
}

/**
 * A delivery channel. Adding mobile push (phase 8) means writing one more of
 * these and registering it — the publish pipeline doesn't change.
 */
export interface AlertChannel {
  name: AlertChannelName;
  /** `null` = this channel doesn't apply to the alert; nothing is logged. */
  deliver(alert: AlertDoc): Promise<DeliveryOutcome | null>;
}
