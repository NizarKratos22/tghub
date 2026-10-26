import { z } from 'zod';
import { ALERT_AUDIENCES, ALERT_CATEGORIES, MISSION_CADENCES, ROLES, SOURCE_ADAPTERS, TRACKABLE_EVENTS, USER_STATUSES } from '../constants';
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

export const sourceInputSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    adapter: z.enum(SOURCE_ADAPTERS),
    config: z.object({
      appId: z.number().int().positive().nullable().default(null),
      /** steam_free only: also list free DLC, not just full games. */
      includeDlc: z.boolean().default(false),
    }),
    gameId: objectIdSchema.nullable().default(null),
    category: z.enum(ALERT_CATEGORIES).default('game_update'),
    intervalMinutes: z.number().int().min(15).max(1440).default(60),
    enabled: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.adapter === 'steam_news' && !value.config.appId) {
      ctx.addIssue({ code: 'custom', message: 'Enter the Steam app id', path: ['config', 'appId'] });
    }
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
    title: z.string().trim().min(3).max(60),
    description: z.string().trim().max(160),
    xpReward: z.number().int().min(0).max(5000),
    target: z.number().int().min(1).max(1000),
  })
  .partial();
export type MissionUpdateInput = z.infer<typeof missionUpdateSchema>;

/** A new mission. Season missions run between two dates; daily and weekly ones repeat. */
export const missionCreateSchema = z
  .object({
    title: z.string().trim().min(3).max(60),
    description: z.string().trim().max(160).default(''),
    cadence: z.enum(MISSION_CADENCES),
    event: z.enum(TRACKABLE_EVENTS),
    target: z.number().int().min(1).max(1000),
    xpReward: z.number().int().min(0).max(5000),
    startsAt: z.coerce.date().nullable().default(null),
    endsAt: z.coerce.date().nullable().default(null),
  })
  .superRefine((value, ctx) => {
    if (value.cadence !== 'special') return;
    if (!value.startsAt) ctx.addIssue({ code: 'custom', message: 'Season missions need a start date', path: ['startsAt'] });
    if (!value.endsAt) ctx.addIssue({ code: 'custom', message: 'Season missions need an end date', path: ['endsAt'] });
    if (value.startsAt && value.endsAt && value.endsAt <= value.startsAt) {
      ctx.addIssue({ code: 'custom', message: 'Must end after it starts', path: ['endsAt'] });
    }
  });
export type MissionCreateInput = z.infer<typeof missionCreateSchema>;

export const achievementInputSchema = z.object({
  title: z.string().trim().min(3).max(60),
  description: z.string().trim().max(160).default(''),
  criteria: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('event_count'), event: z.enum(TRACKABLE_EVENTS), count: z.number().int().min(1).max(100_000) }),
    z.object({ kind: z.literal('level'), level: z.number().int().min(2).max(200) }),
  ]),
  xpReward: z.number().int().min(0).max(10_000).default(0),
  /** A title players can wear, or a profile badge. */
  cosmetic: z
    .object({ kind: z.enum(['title', 'badge']), value: z.string().trim().min(2).max(32) })
    .nullable()
    .default(null),
});
export type AchievementInput = z.infer<typeof achievementInputSchema>;

/** A season and its community Pulse. Milestones are given as a share of the goal. */
export const seasonInputSchema = z
  .object({
    title: z.string().trim().min(3).max(60),
    description: z.string().trim().max(300).default(''),
    goal: z.number().int().min(1_000).max(100_000_000),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    milestones: z
      .array(z.object({ percent: z.number().int().min(1).max(100), reward: z.string().trim().min(2).max(80) }))
      .max(10)
      .default([]),
  })
  .superRefine((value, ctx) => {
    if (value.endsAt <= value.startsAt) ctx.addIssue({ code: 'custom', message: 'Must end after it starts', path: ['endsAt'] });
    const percents = value.milestones.map((m) => m.percent);
    if (new Set(percents).size !== percents.length) ctx.addIssue({ code: 'custom', message: 'Each milestone needs its own %', path: ['milestones'] });
  });
export type SeasonInput = z.infer<typeof seasonInputSchema>;

/** Give (positive) or take back (negative) XP, with the reason the player will see. */
export const xpAdjustSchema = z.object({
  username: z.string().trim().min(3).max(20),
  amount: z
    .number()
    .int()
    .min(-100_000)
    .max(100_000)
    .refine((value) => value !== 0, 'Enter a positive or negative amount'),
  reason: z.string().trim().min(3).max(140),
});
export type XpAdjustInput = z.infer<typeof xpAdjustSchema>;

export const seasonKeyParamsSchema = z.object({ key: z.string().trim().min(1).max(60) });

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
