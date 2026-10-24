import { z } from 'zod';
import { ALERT_AUDIENCES, ALERT_CATEGORIES, ROLES, SOURCE_ADAPTERS, USER_STATUSES } from '../constants';
import { objectIdSchema, optionalSearchSchema, pageSchema, pageSizeSchema } from './common';

export const publishAlertSchema = z.object({
  category: z.enum(ALERT_CATEGORIES),
  title: z.string().trim().min(3).max(140),
  summary: z.string().trim().max(400).default(''),
  url: z.url().nullable().default(null),
  gameId: objectIdSchema.nullable().default(null),
  sourceName: z.string().trim().min(1).max(60).default('TG Hub'),
  /** Same key twice = same alert. Defaults to a hash of category + link/title. */
  dedupKey: z.string().trim().min(3).max(200).optional(),
  /** Defaults to game followers for game updates with a game, everyone otherwise. */
  audience: z.enum(ALERT_AUDIENCES).optional(),
});
export type PublishAlertInput = z.infer<typeof publishAlertSchema>;

export const sourceInputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  adapter: z.enum(SOURCE_ADAPTERS),
  config: z.object({ appId: z.number().int().positive() }),
  gameId: objectIdSchema.nullable().default(null),
  category: z.enum(ALERT_CATEGORIES).default('game_update'),
  intervalMinutes: z.number().int().min(15).max(1440).default(60),
  enabled: z.boolean().default(true),
});
export type SourceInput = z.infer<typeof sourceInputSchema>;

export const sourceUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    category: z.enum(ALERT_CATEGORIES),
    intervalMinutes: z.number().int().min(15).max(1440),
    enabled: z.boolean(),
  })
  .partial();
export type SourceUpdateInput = z.infer<typeof sourceUpdateSchema>;

export const DISCORD_WEBHOOK_PATTERN = /^https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export const discordTargetInputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  webhookUrl: z.string().trim().regex(DISCORD_WEBHOOK_PATTERN, 'Paste a Discord channel webhook URL'),
  categories: z.array(z.enum(ALERT_CATEGORIES)).min(1, 'Pick at least one category'),
  enabled: z.boolean().default(true),
});
export type DiscordTargetInput = z.infer<typeof discordTargetInputSchema>;

export const discordTargetUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    categories: z.array(z.enum(ALERT_CATEGORIES)).min(1),
    enabled: z.boolean(),
  })
  .partial();
export type DiscordTargetUpdateInput = z.infer<typeof discordTargetUpdateSchema>;

export const adminUserQuerySchema = z.object({
  q: optionalSearchSchema,
  page: pageSchema,
  pageSize: pageSizeSchema,
});

export const adminUserUpdateSchema = z
  .object({
    role: z.enum(ROLES),
    status: z.enum(USER_STATUSES),
  })
  .partial();

export const missionUpdateSchema = z
  .object({
    active: z.boolean(),
    xpReward: z.number().int().min(0).max(5000),
    target: z.number().int().min(1).max(1000),
  })
  .partial();
export type MissionUpdateInput = z.infer<typeof missionUpdateSchema>;

export const deliveryLogQuerySchema = z.object({
  alertId: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** Dashboard windows, in days. Each is compared with the window right before it. */
export const ADMIN_STATS_RANGES = [7, 30, 90] as const;

export const adminStatsQuerySchema = z.object({
  days: z.coerce
    .number()
    .default(30)
    .pipe(z.union(ADMIN_STATS_RANGES.map((value) => z.literal(value)) as [z.ZodLiteral<7>, z.ZodLiteral<30>, z.ZodLiteral<90>])),
});
