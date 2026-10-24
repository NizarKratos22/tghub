import { z } from 'zod';
import { RESOURCE_KINDS } from '../constants';
import { objectIdSchema, optionalSearchSchema, pageSchema, pageSizeSchema, slugSchema } from './common';

export const radarListQuerySchema = z.object({
  q: optionalSearchSchema,
  kind: z.enum(RESOURCE_KINDS).optional(),
  game: slugSchema.optional(),
  /** Hide deals and events that already ended. */
  active: z.stringbool().optional(),
  page: pageSchema,
  pageSize: pageSizeSchema,
});
export type RadarListQuery = z.infer<typeof radarListQuerySchema>;

export const radarSearchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Type at least 2 characters').max(80),
});

export const CURRENCIES = ['TND', 'USD', 'EUR'] as const;

export const dealSchema = z.object({
  store: z.string().trim().min(1).max(40),
  price: z.number().min(0),
  originalPrice: z.number().min(0).nullable(),
  currency: z.enum(CURRENCIES).default('USD'),
});

export const resourceInputSchema = z
  .object({
    kind: z.enum(RESOURCE_KINDS),
    title: z.string().trim().min(3).max(160),
    summary: z.string().trim().max(500).default(''),
    url: z.url(),
    sourceName: z.string().trim().min(1).max(60),
    gameId: objectIdSchema.nullable().default(null),
    tags: z.array(z.string().trim().toLowerCase().max(24)).max(10).default([]),
    publishedAt: z.coerce.date().optional(),
    startsAt: z.coerce.date().nullable().default(null),
    expiresAt: z.coerce.date().nullable().default(null),
    location: z.string().trim().max(80).nullable().default(null),
    deal: dealSchema.nullable().default(null),
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'deal' && !value.deal) {
      ctx.addIssue({ code: 'custom', message: 'Deals need price details', path: ['deal'] });
    }
    if (value.kind === 'event' && !value.startsAt) {
      ctx.addIssue({ code: 'custom', message: 'Events need a start date', path: ['startsAt'] });
    }
  });
export type ResourceInput = z.infer<typeof resourceInputSchema>;

export const BOOKMARK_TARGETS = ['game', 'resource', 'listing'] as const;
export type BookmarkTarget = (typeof BOOKMARK_TARGETS)[number];

export const bookmarkInputSchema = z.object({
  targetType: z.enum(BOOKMARK_TARGETS),
  targetId: objectIdSchema,
});

export const bookmarkParamsSchema = bookmarkInputSchema;

export const bookmarkListQuerySchema = z.object({
  targetType: z.enum(BOOKMARK_TARGETS).default('game'),
});
