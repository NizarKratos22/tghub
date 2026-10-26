import { z } from 'zod';
import { GAME_MODES, GENRES, PLATFORMS } from '../constants';
import {
  hexColorSchema,
  objectIdSchema,
  optionalSearchSchema,
  pageSchema,
  pageSizeSchema,
  slugSchema,
} from './common';

export const GAME_SORTS = ['popular', 'newest', 'title'] as const;
export type GameSort = (typeof GAME_SORTS)[number];

export const gameListQuerySchema = z.object({
  q: optionalSearchSchema,
  genre: z.enum(GENRES).optional(),
  platform: z.enum(PLATFORMS).optional(),
  free: z.stringbool().optional(),
  sort: z.enum(GAME_SORTS).default('popular'),
  page: pageSchema,
  pageSize: pageSizeSchema,
});
export type GameListQuery = z.infer<typeof gameListQuerySchema>;

export const requirementTierSchema = z.object({
  cpuLabel: z.string().trim().min(1).max(160),
  gpuLabel: z.string().trim().min(1).max(160),
  cpuScore: z.number().int().min(0).nullable(),
  gpuScore: z.number().int().min(0).nullable(),
  ramGb: z.number().min(1).max(256),
  vramGb: z.number().min(0).max(64).nullable(),
  storageGb: z.number().min(1).max(1000).nullable(),
  os: z.string().trim().max(80).nullable(),
});
export type RequirementTierInput = z.infer<typeof requirementTierSchema>;

export const gameInputSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1).max(80),
  monogram: z.string().trim().min(1).max(4).toUpperCase(),
  tagline: z.string().trim().max(140).default(''),
  description: z.string().trim().max(4000).default(''),
  genres: z.array(z.enum(GENRES)).min(1),
  platforms: z.array(z.enum(PLATFORMS)).min(1),
  modes: z.array(z.enum(GAME_MODES)).default([]),
  developer: z.string().trim().max(80).default(''),
  publisher: z.string().trim().max(80).default(''),
  releaseDate: z.coerce.date().nullable().default(null),
  freeToPlay: z.boolean().default(false),
  accent: hexColorSchema.default('#e10600'),
  coverUrl: z.url().nullable().default(null),
  aliases: z.array(z.string().trim().toLowerCase().max(20)).max(10).default([]),
  tags: z.array(z.string().trim().toLowerCase().max(24)).max(12).default([]),
  languages: z.array(z.string().trim().max(24)).max(20).default([]),
  steamAppId: z.number().int().positive().nullable().default(null),
  links: z
    .object({ official: z.url().nullable(), store: z.url().nullable() })
    .default({ official: null, store: null }),
  requirements: z
    .object({
      minimum: requirementTierSchema.nullable(),
      recommended: requirementTierSchema.nullable(),
      source: z.string().trim().max(120).nullable(),
    })
    .default({ minimum: null, recommended: null, source: null }),
  popularity: z.number().int().min(0).max(100).default(50),
  featured: z.boolean().default(false),
  status: z.enum(['published', 'draft']).default('published'),
});
export type GameInput = z.infer<typeof gameInputSchema>;

export const gameUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    tagline: z.string().trim().max(140),
    description: z.string().trim().max(4000),
    popularity: z.number().int().min(0).max(100),
    featured: z.boolean(),
    status: z.enum(['published', 'draft']),
    coverUrl: z.url().nullable(),
    steamAppId: z.number().int().positive().nullable(),
  })
  .partial();
export type GameUpdateInput = z.infer<typeof gameUpdateSchema>;

export const gameIdParamsSchema = z.object({ gameId: objectIdSchema });

/** IGDB ids are positive integers; the admin pastes one or picks it from a search. */
export const igdbIdSchema = z.coerce.number().int().positive().max(10_000_000);
export const igdbSearchQuerySchema = z.object({ q: z.string().trim().min(2).max(80) });
export const igdbImportSchema = z.object({ igdbId: igdbIdSchema });
export const igdbLinkSchema = z.object({ igdbId: igdbIdSchema });
