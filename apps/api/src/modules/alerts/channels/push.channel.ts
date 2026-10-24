import type { Types } from 'mongoose';
import { realtime } from '../../../core/realtime/hub';
import { sendPush } from '../../push/push.service';
import { Notification } from '../alerts.model';
import { pushTarget } from '../live';
import type { AlertChannel } from './channel';

/**
 * Phone and desktop notifications. Runs after the inbox channel and reaches
 * exactly the players who got an inbox row (so preferences and daily caps
 * apply), minus anyone on the site right now — they already saw the toast.
 */
export const pushChannel: AlertChannel = {
  name: 'push',
  async deliver(alert) {
    const rows = await Notification.find({ alertId: alert._id, readAt: null }).select('userId').lean<Array<{ userId: Types.ObjectId }>>();
    const away = [...new Set(rows.map((row) => String(row.userId)))].filter((userId) => !realtime.isOnline(userId));
    if (away.length === 0) return null;

    const result = await sendPush(
      away,
      { title: alert.title, body: alert.summary || alert.sourceName, url: pushTarget(alert.url), tag: `alert-${String(alert._id)}` },
      // Personal alerts (a buyer's message, a level-up) are worth waking a phone for.
      { urgency: alert.recipients.length > 0 ? 'high' : 'normal' },
    );
    if (result.devices === 0) return null;
    return {
      status: result.sent > 0 ? 'sent' : 'failed',
      recipients: result.sent,
      detail: result.sent < result.devices ? `${result.devices - result.sent} of ${result.devices} devices failed` : null,
    };
  },
};
