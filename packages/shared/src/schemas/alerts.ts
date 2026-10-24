import { z } from 'zod';
import { ALERT_CATEGORIES } from '../constants';
import { objectIdSchema } from './common';

export const notificationQuerySchema = z.object({
  status: z.enum(['all', 'unread']).default('all'),
  category: z.enum(ALERT_CATEGORIES).optional(),
  /** Cursor: id of the last notification already shown. */
  before: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type NotificationQuery = z.infer<typeof notificationQuerySchema>;

export const alertPreferencesUpdateSchema = z
  .object({
    categories: z.partialRecord(z.enum(ALERT_CATEGORIES), z.boolean()),
    followedGameIds: z.array(objectIdSchema).max(100),
    followAllGames: z.boolean(),
    maxPerDay: z.number().int().min(1).max(100),
  })
  .partial();
export type AlertPreferencesUpdate = z.infer<typeof alertPreferencesUpdateSchema>;
