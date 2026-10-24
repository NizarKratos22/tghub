import { z } from 'zod';
import { CLAN_COLORS, CLAN_JOIN_POLICIES, LFG_DURATIONS_HOURS, LFG_LANGUAGES, LFG_MAX_SLOTS, MAX_CLAN_GAMES, PLATFORMS } from '../constants';
import { countrySchema } from './auth';
import { objectIdSchema, optionalSearchSchema, pageSchema } from './common';

/* ── Clans ── */

export const clanTagSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{2,5}$/, 'Use 2–5 letters or digits');

const clanFields = {
  name: z.string().trim().min(3, 'At least 3 characters').max(32, 'Up to 32 characters'),
  description: z.string().trim().max(500, 'Up to 500 characters'),
  color: z.enum(CLAN_COLORS),
  joinPolicy: z.enum(CLAN_JOIN_POLICIES),
  country: countrySchema.nullable(),
  gameIds: z.array(objectIdSchema).max(MAX_CLAN_GAMES, `Up to ${MAX_CLAN_GAMES} games`),
};

export const clanInputSchema = z.object({
  tag: clanTagSchema,
  ...clanFields,
  description: clanFields.description.default(''),
  color: clanFields.color.default(CLAN_COLORS[0]),
  joinPolicy: clanFields.joinPolicy.default('request'),
  country: clanFields.country.default(null),
  gameIds: clanFields.gameIds.default([]),
});
export type ClanInput = z.infer<typeof clanInputSchema>;

/** No defaults here: a partial update must leave unsent fields alone. */
export const clanUpdateSchema = z.object(clanFields).partial();
export type ClanUpdateInput = z.infer<typeof clanUpdateSchema>;

export const clanTagParamsSchema = z.object({ tag: clanTagSchema });
export const clanMemberParamsSchema = z.object({ tag: clanTagSchema, userId: objectIdSchema });
export const clanRequestParamsSchema = z.object({ tag: clanTagSchema, requestId: objectIdSchema });

export const clanApplySchema = z.object({ message: z.string().trim().max(200, 'Up to 200 characters').default('') });
export const clanRoleUpdateSchema = z.object({ role: z.enum(['officer', 'member']) });
export const clanDecisionSchema = z.object({ accept: z.boolean() });

export const CLAN_SORTS = ['season', 'xp', 'members', 'new'] as const;
export const clanListQuerySchema = z.object({
  q: optionalSearchSchema,
  gameId: objectIdSchema.optional(),
  country: countrySchema.optional(),
  recruiting: z.stringbool().optional(),
  sort: z.enum(CLAN_SORTS).default('season'),
  page: pageSchema,
});
export type ClanListQuery = z.infer<typeof clanListQuerySchema>;

/* ── Teammate finder ── */

export const lfgPostInputSchema = z.object({
  gameId: objectIdSchema,
  platform: z.enum(PLATFORMS),
  mode: z.string().trim().min(2, 'Say what you want to play').max(40, 'Up to 40 characters'),
  rank: z.string().trim().max(30, 'Up to 30 characters').default(''),
  slots: z.coerce.number().int().min(1).max(LFG_MAX_SLOTS),
  languages: z.array(z.enum(LFG_LANGUAGES)).min(1, 'Pick at least one language').max(LFG_LANGUAGES.length),
  micRequired: z.boolean().default(false),
  note: z.string().trim().max(280, 'Up to 280 characters').default(''),
  /** Discord name or in-game ID — only shown to players you accept. */
  contact: z.string().trim().min(2, 'Add how accepted players reach you').max(80, 'Up to 80 characters'),
  durationHours: z.literal(LFG_DURATIONS_HOURS, 'Pick how long the post stays up'),
});
export type LfgPostInput = z.infer<typeof lfgPostInputSchema>;

export const lfgListQuerySchema = z.object({
  gameId: objectIdSchema.optional(),
  platform: z.enum(PLATFORMS).optional(),
  language: z.enum(LFG_LANGUAGES).optional(),
  mine: z.stringbool().optional(),
  page: pageSchema,
});
export type LfgListQuery = z.infer<typeof lfgListQuerySchema>;

export const lfgJoinSchema = z.object({
  message: z.string().trim().max(200, 'Up to 200 characters').default(''),
  /** The applicant's own Discord / in-game ID, shown to the post's author. */
  contact: z.string().trim().min(2, 'Add how the host can reach you').max(80, 'Up to 80 characters'),
});
export type LfgJoinInput = z.infer<typeof lfgJoinSchema>;

export const lfgRequestParamsSchema = z.object({ id: objectIdSchema, requestId: objectIdSchema });
export const lfgDecisionSchema = z.object({ accept: z.boolean() });
