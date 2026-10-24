import { z } from 'zod';
import {
  ASSET_DELIVERIES,
  ASSET_SOURCES,
  FIVEM_FRAMEWORKS,
  isDigitalCategory,
  isSubcategoryOf,
  LISTING_STATUSES,
  MARKET_CATEGORIES,
  MARKET_CONDITIONS,
  MARKET_REPORT_REASONS,
  MARKET_SORTS,
  MAX_LISTING_PHOTOS,
  MAX_LISTING_PRICE_TND,
  SELLER_LISTING_STATUSES,
  FEATURE_PLAN_IDS,
  type FeaturePlan,
  TN_REGIONS,
} from '../constants';
import { objectIdSchema, optionalSearchSchema, pageSchema } from './common';

/** Query-string booleans: "true" / "false"; anything blank means "don't filter". */
const optionalFlag = z.preprocess((value) => (value === '' ? undefined : value), z.stringbool().optional());
const optionalPrice = z.preprocess((value) => (value === '' ? undefined : value), z.coerce.number().int().min(0).max(MAX_LISTING_PRICE_TND).optional());

export const marketListQuerySchema = z.object({
  q: optionalSearchSchema,
  category: z.enum(MARKET_CATEGORIES).optional(),
  sub: z.string().trim().max(30).optional(),
  region: z.enum(TN_REGIONS).optional(),
  condition: z.enum(MARKET_CONDITIONS).optional(),
  framework: z.enum(FIVEM_FRAMEWORKS).optional(),
  minPrice: optionalPrice,
  maxPrice: optionalPrice,
  shipping: optionalFlag,
  /** A seller's public shop. */
  seller: z.string().trim().min(3).max(24).optional(),
  sort: z.enum(MARKET_SORTS).default('newest'),
  page: pageSchema,
  pageSize: z.coerce.number().int().min(1).max(48).default(24),
});
export type MarketListQuery = z.infer<typeof marketListQuerySchema>;

/** The filters a saved search remembers — everything on the browse page except paging, sort and seller. */
export const searchCriteriaSchema = marketListQuerySchema
  .pick({ q: true, category: true, sub: true, region: true, condition: true, framework: true, minPrice: true, maxPrice: true, shipping: true })
  .refine((criteria) => Object.values(criteria).some((value) => value !== undefined), 'Pick at least one filter or search term to save');
export type SearchCriteria = z.infer<typeof searchCriteriaSchema>;

export const savedSearchSchema = z.object({
  criteria: searchCriteriaSchema,
  name: z.string().trim().min(1).max(60).optional(),
  notify: z.boolean().default(true),
});
export type SavedSearchInput = z.infer<typeof savedSearchSchema>;

export const savedSearchUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Give it a name').max(60, 'Up to 60 characters').optional(),
  notify: z.boolean().optional(),
});

const digitalDetailsSchema = z.object({
  framework: z.enum(FIVEM_FRAMEWORKS).nullable().default(null),
  delivery: z.enum(ASSET_DELIVERIES),
  source: z.enum(ASSET_SOURCES),
  /** Leaks are the FiveM scene's biggest problem; sellers vouch for every digital listing. */
  rightsConfirmed: z.literal(true, 'Confirm you own the rights to sell this asset'),
});

/**
 * One schema for create and edit (the form always sends the whole listing).
 * Physical and digital listings need different details, checked below with
 * field paths that land on the right form input.
 */
export const listingInputSchema = z
  .object({
    title: z.string().trim().min(4, 'Give it a title of at least 4 characters').max(90),
    description: z.string().trim().min(10, 'Describe it in at least 10 characters').max(4000),
    category: z.enum(MARKET_CATEGORIES, 'Pick a category'),
    subcategory: z.string().trim().max(30).nullable().default(null),
    price: z.number('Enter a price').int('Whole dinars only').min(0).max(MAX_LISTING_PRICE_TND),
    negotiable: z.boolean().default(false),
    openToTrades: z.boolean().default(false),
    condition: z.enum(MARKET_CONDITIONS).nullable().default(null),
    region: z.enum(TN_REGIONS).nullable().default(null),
    area: z.string().trim().max(60).default(''),
    meetup: z.boolean().default(false),
    shipping: z.boolean().default(false),
    digital: digitalDetailsSchema.nullable().default(null),
    photoIds: z
      .array(objectIdSchema)
      .min(1, 'Add at least one photo')
      .max(MAX_LISTING_PHOTOS, `Up to ${MAX_LISTING_PHOTOS} photos`)
      .refine((ids) => new Set(ids).size === ids.length, 'The same photo is attached twice'),
  })
  .superRefine((value, ctx) => {
    if (value.subcategory && !isSubcategoryOf(value.category, value.subcategory)) {
      ctx.addIssue({ code: 'custom', path: ['subcategory'], message: 'Pick a type from this category' });
    }
    if (isDigitalCategory(value.category)) {
      if (!value.digital) {
        ctx.addIssue({ code: 'custom', path: ['digital'], message: 'Add the delivery details for this asset' });
      } else if (value.category === 'fivem' && !value.digital.framework) {
        ctx.addIssue({ code: 'custom', path: ['digital', 'framework'], message: 'Which framework does it run on?' });
      }
      return;
    }
    if (!value.condition) ctx.addIssue({ code: 'custom', path: ['condition'], message: 'Pick a condition' });
    if (!value.region) ctx.addIssue({ code: 'custom', path: ['region'], message: 'Where is the item?' });
    if (!value.meetup && !value.shipping) {
      ctx.addIssue({ code: 'custom', path: ['meetup'], message: 'Offer meet-up, delivery or both' });
    }
  });
export type ListingInput = z.infer<typeof listingInputSchema>;

export const listingStatusUpdateSchema = z.object({
  status: z.enum(SELLER_LISTING_STATUSES),
  /** When marking sold: the player from the chats who bought it (null = someone outside TG Hub). */
  buyerId: objectIdSchema.nullable().optional(),
});

export const featureOrderSchema = z.object({
  listingId: objectIdSchema,
  plan: z.enum(FEATURE_PLAN_IDS as [FeaturePlan, ...FeaturePlan[]], 'Pick how long to feature it'),
});
export type FeatureOrderInput = z.infer<typeof featureOrderSchema>;

/* ── Seller ratings ── */

export const sellerRatingSchema = z.object({
  stars: z.coerce.number().int().min(1, 'Pick 1 to 5 stars').max(5, 'Pick 1 to 5 stars'),
  comment: z.string().trim().max(500, 'Up to 500 characters').default(''),
});
export type SellerRatingInput = z.infer<typeof sellerRatingSchema>;

export const ratingReplySchema = z.object({
  reply: z.string().trim().min(1, 'Write a reply').max(500, 'Up to 500 characters'),
});

export const sellerVerificationSchema = z.object({
  /** "auto" follows the rules; the other two are a moderator's call. */
  override: z.enum(['auto', 'verified', 'revoked']),
});

export const myListingsQuerySchema = z.object({
  status: z.enum(SELLER_LISTING_STATUSES).optional(),
});

export const marketMessageSchema = z.object({
  body: z.string().trim().min(1, 'Write a message').max(2000, 'Keep it under 2,000 characters'),
});
export type MarketMessageInput = z.infer<typeof marketMessageSchema>;

export const conversationListQuerySchema = z.object({
  role: z.enum(['all', 'buying', 'selling']).default('all'),
});

export const messageHistoryQuerySchema = z.object({
  /** Message id: return messages older than this one. */
  before: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const listingReportSchema = z.object({
  reason: z.enum(MARKET_REPORT_REASONS, 'Pick a reason'),
  details: z.string().trim().max(500).default(''),
});
export type ListingReportInput = z.infer<typeof listingReportSchema>;

export const adminListingQuerySchema = z.object({
  q: optionalSearchSchema,
  status: z.enum(LISTING_STATUSES).optional(),
  flagged: optionalFlag,
  page: pageSchema,
  pageSize: z.coerce.number().int().min(1).max(48).default(24),
});

export const adminListingUpdateSchema = z
  .object({
    status: z.enum(['active', 'removed']),
    /** Shown to the seller when a listing is taken down. */
    moderationNote: z.string().trim().max(300),
    flagged: z.boolean(),
  })
  .partial();
export type AdminListingUpdateInput = z.infer<typeof adminListingUpdateSchema>;

export const mediaParamsSchema = z.object({
  file: z.string().regex(/^[a-f\d]{24}-(full|thumb)\.webp$/i, 'Unknown file'),
});
