import { z } from 'zod';
import { TOURNAMENT_LISTS, TOURNAMENT_PROVIDERS, TOURNAMENT_WHERE } from '../constants';
import { objectIdSchema, optionalSearchSchema, pageSchema, pageSizeSchema, slugSchema } from './common';

export const tournamentListQuerySchema = z.object({
  list: z.enum(TOURNAMENT_LISTS).default('upcoming'),
  where: z.enum(TOURNAMENT_WHERE).default('all'),
  game: slugSchema.optional(),
  provider: z.enum(TOURNAMENT_PROVIDERS).optional(),
  q: optionalSearchSchema,
  page: pageSchema,
  pageSize: pageSizeSchema,
});
export type TournamentListQuery = z.infer<typeof tournamentListQuerySchema>;

/** Pull one tournament from its public page URL (start.gg or FACEIT). */
export const tournamentImportSchema = z.object({
  url: z.url('Paste the tournament page URL').max(500),
});

const sourceBase = {
  name: z.string().trim().min(2).max(60),
  /** Catalogue game to attach discovered tournaments to. */
  gameId: objectIdSchema.nullable().default(null),
  intervalMinutes: z.number().int().min(30).max(1440).default(180),
  enabled: z.boolean().default(true),
};

export const tournamentSourceInputSchema = z.discriminatedUnion('provider', [
  z.object({
    ...sourceBase,
    provider: z.literal('startgg'),
    config: z.object({
      videogameId: z.number().int().positive(),
      /** ISO 3166-1 alpha-2. "TN" keeps discovery to Tunisian events. */
      countryCode: z.string().trim().toUpperCase().length(2).nullable().default(null),
    }),
  }),
  z.object({
    ...sourceBase,
    provider: z.literal('faceit'),
    config: z.object({
      game: z.string().trim().min(2).max(40),
      region: z.string().trim().max(20).nullable().default(null),
    }),
  }),
]);
export type TournamentSourceInput = z.infer<typeof tournamentSourceInputSchema>;

export const tournamentSourceUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    gameId: objectIdSchema.nullable(),
    intervalMinutes: z.number().int().min(30).max(1440),
    enabled: z.boolean(),
  })
  .partial();
export type TournamentSourceUpdateInput = z.infer<typeof tournamentSourceUpdateSchema>;

export const adminTournamentQuerySchema = z.object({
  q: optionalSearchSchema,
  page: pageSchema,
  pageSize: pageSizeSchema,
});

export const adminTournamentUpdateSchema = z
  .object({
    hidden: z.boolean(),
    featured: z.boolean(),
    gameId: objectIdSchema.nullable(),
  })
  .partial();
export type AdminTournamentUpdateInput = z.infer<typeof adminTournamentUpdateSchema>;

export const startggGameLookupSchema = z.object({
  q: z.string().trim().min(2).max(60),
});
