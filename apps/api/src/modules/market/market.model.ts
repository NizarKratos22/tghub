import { model, Schema, type Types } from 'mongoose';
import {
  ASSET_DELIVERIES,
  ASSET_SOURCES,
  FIVEM_FRAMEWORKS,
  LISTING_STATUSES,
  MARKET_CATEGORIES,
  MARKET_CONDITIONS,
  MARKET_REPORT_REASONS,
  TN_REGIONS,
  type AssetDelivery,
  type AssetSource,
  type FivemFramework,
  type ListingStatus,
  type MarketCategory,
  type MarketCondition,
  type MarketReportReason,
  type MarketSubcategory,
  type TnRegion,
} from '@tgh/shared';

/* ───────────── Listings ───────────── */

export interface ListingDigitalDoc {
  framework: FivemFramework | null;
  delivery: AssetDelivery;
  source: AssetSource;
}

export interface ListingDoc {
  _id: Types.ObjectId;
  sellerId: Types.ObjectId;
  title: string;
  description: string;
  category: MarketCategory;
  subcategory: MarketSubcategory | null;
  /** Whole TND. */
  price: number;
  negotiable: boolean;
  openToTrades: boolean;
  condition: MarketCondition | null;
  region: TnRegion | null;
  area: string;
  meetup: boolean;
  shipping: boolean;
  digital: ListingDigitalDoc | null;
  /** Ordered; the first one is the cover. */
  photoIds: Types.ObjectId[];
  status: ListingStatus;
  bumpedAt: Date;
  soldAt: Date | null;
  /** The TG Hub player it was sold to, picked by the seller from the chats. */
  buyerId?: Types.ObjectId | null;
  /** Paid boost: shows "Featured" and joins the featured row until then. */
  featuredUntil?: Date | null;
  views: number;
  flagged: boolean;
  reportCount: number;
  moderationNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const digitalSchema = new Schema<ListingDigitalDoc>(
  {
    framework: { type: String, enum: [...FIVEM_FRAMEWORKS, null], default: null },
    delivery: { type: String, enum: ASSET_DELIVERIES, required: true },
    source: { type: String, enum: ASSET_SOURCES, required: true },
  },
  { _id: false },
);

const listingSchema = new Schema<ListingDoc>(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, enum: MARKET_CATEGORIES, required: true },
    subcategory: { type: String, default: null },
    price: { type: Number, required: true, min: 0 },
    negotiable: { type: Boolean, default: false },
    openToTrades: { type: Boolean, default: false },
    condition: { type: String, enum: [...MARKET_CONDITIONS, null], default: null },
    region: { type: String, enum: [...TN_REGIONS, null], default: null },
    area: { type: String, default: '' },
    meetup: { type: Boolean, default: false },
    shipping: { type: Boolean, default: false },
    digital: { type: digitalSchema, default: null },
    photoIds: { type: [Schema.Types.ObjectId], default: [] },
    status: { type: String, enum: LISTING_STATUSES, default: 'active' },
    bumpedAt: { type: Date, required: true },
    soldAt: { type: Date, default: null },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    featuredUntil: { type: Date, default: null },
    views: { type: Number, default: 0 },
    flagged: { type: Boolean, default: false },
    reportCount: { type: Number, default: 0 },
    moderationNote: { type: String, default: null },
  },
  { timestamps: true },
);

// Browse: status first, then the facet, then the sort key.
listingSchema.index({ status: 1, bumpedAt: -1 });
listingSchema.index({ status: 1, category: 1, bumpedAt: -1 });
listingSchema.index({ status: 1, category: 1, price: 1 });
listingSchema.index({ status: 1, region: 1, bumpedAt: -1 });
listingSchema.index({ sellerId: 1, status: 1, bumpedAt: -1 });
listingSchema.index({ flagged: 1, updatedAt: -1 });
listingSchema.index({ status: 1, featuredUntil: -1 });
// English stemming: "scripts" finds "script", "cars" finds "car".
listingSchema.index({ title: 'text', description: 'text' }, { weights: { title: 5, description: 1 }, default_language: 'english', name: 'listing_text' });

export const Listing = model<ListingDoc>('Listing', listingSchema);

/* ───────────── Conversations ───────────── */

/** One thread per (listing, buyer). Unread counters are per side so the badge is one indexed count. */
export interface ConversationDoc {
  _id: Types.ObjectId;
  listingId: Types.ObjectId;
  sellerId: Types.ObjectId;
  buyerId: Types.ObjectId;
  lastMessage: { body: string; senderId: Types.ObjectId; at: Date } | null;
  lastMessageAt: Date;
  buyerUnread: number;
  sellerUnread: number;
  /** When each side last had the thread open — the other side sees "Seen". Missing on older threads. */
  buyerReadAt?: Date | null;
  sellerReadAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<ConversationDoc>(
  {
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastMessage: {
      type: new Schema({ body: String, senderId: Schema.Types.ObjectId, at: Date }, { _id: false }),
      default: null,
    },
    lastMessageAt: { type: Date, required: true },
    buyerUnread: { type: Number, default: 0 },
    sellerUnread: { type: Number, default: 0 },
    buyerReadAt: { type: Date, default: null },
    sellerReadAt: { type: Date, default: null },
  },
  { timestamps: true },
);

conversationSchema.index({ listingId: 1, buyerId: 1 }, { unique: true });
conversationSchema.index({ buyerId: 1, lastMessageAt: -1 });
conversationSchema.index({ sellerId: 1, lastMessageAt: -1 });

export const Conversation = model<ConversationDoc>('Conversation', conversationSchema);

export interface MarketMessageDoc {
  _id: Types.ObjectId;
  conversationId: Types.ObjectId;
  senderId: Types.ObjectId;
  body: string;
  createdAt: Date;
}

const messageSchema = new Schema<MarketMessageDoc>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

messageSchema.index({ conversationId: 1, _id: -1 });

export const MarketMessage = model<MarketMessageDoc>('MarketMessage', messageSchema);

/* ───────────── Reports ───────────── */

export interface ListingReportDoc {
  _id: Types.ObjectId;
  listingId: Types.ObjectId;
  reporterId: Types.ObjectId;
  reason: MarketReportReason;
  details: string;
  createdAt: Date;
}

const reportSchema = new Schema<ListingReportDoc>(
  {
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true },
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, enum: MARKET_REPORT_REASONS, required: true },
    details: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

reportSchema.index({ listingId: 1, reporterId: 1 }, { unique: true });
reportSchema.index({ listingId: 1, createdAt: -1 });

export const ListingReport = model<ListingReportDoc>('ListingReport', reportSchema);

/* ───────────── Seller ratings ───────────── */

/** One per sale: only the buyer the seller picked can leave it, and the seller can answer once. */
export interface SellerRatingDoc {
  _id: Types.ObjectId;
  listingId: Types.ObjectId;
  sellerId: Types.ObjectId;
  buyerId: Types.ObjectId;
  stars: number;
  comment: string;
  reply: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const sellerRatingSchema = new Schema<SellerRatingDoc>(
  {
    listingId: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, unique: true },
    sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    stars: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, default: '' },
    reply: { type: String, default: null },
  },
  { timestamps: true },
);

sellerRatingSchema.index({ sellerId: 1, _id: -1 });

export const SellerRating = model<SellerRatingDoc>('SellerRating', sellerRatingSchema, 'seller_ratings');
