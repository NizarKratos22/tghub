import type { QueryFilter, SortOrder, Types } from 'mongoose';
import {
  isDigitalCategory,
  isSubcategoryOf,
  MARKET_RENEW_COOLDOWN_HOURS,
  type ListingCard,
  type ListingDetail,
  type ListingInput,
  type ListingStatus,
  type ListingViewerState,
  type MarketCategoryCount,
  type MarketListQuery,
  type MarketSeller,
  type MyListing,
  type MyListings,
  type Page,
  type SellerListingStatus,
  type SearchCriteria,
} from '@tgh/shared';
import { bus } from '../../core/events/bus';
import { AppError } from '../../core/http/errors';
import { paginate, skipFor, toObjectId } from '../../core/http/utils';
import { Bookmark } from '../library/library.model';
import { bookmarkIds, recordView } from '../library/library.service';
import type { MediaDoc } from '../media/media.model';
import { attachMedia, detachMedia, mediaByIds, mediaUrl, ownedMedia } from '../media/media.service';
import { User, type UserDoc } from '../users/user.model';
import { avatarUrlOf, USER_REF_FIELDS } from '../users/users.mapper';
import { toListingCard, toListingDetail, toSellerRef, type SellerSource } from './market.mapper';
import { ratingStateFor, refreshSellerBadge, reputationFor } from './reputation.service';
import { Conversation, Listing, ListingReport, type ListingDoc } from './market.model';

/** Statuses anyone can open by link. Browse shows only what can still be bought. */
export const PUBLIC_STATUSES: ListingStatus[] = ['active', 'pending', 'sold'];
const BROWSE_STATUSES: ListingStatus[] = ['active', 'pending'];
/** Keeps one account from flooding the feed. */
const MAX_OPEN_LISTINGS = 60;
const RENEW_COOLDOWN_MS = MARKET_RENEW_COOLDOWN_HOURS * 3_600_000;

async function coverMedia(docs: ListingDoc[]): Promise<Map<string, MediaDoc>> {
  return mediaByIds(docs.flatMap((doc) => doc.photoIds.slice(0, 1)));
}

export async function toCards(docs: ListingDoc[]): Promise<ListingCard[]> {
  const media = await coverMedia(docs);
  return docs.map((doc) => toListingCard(doc, media));
}

/* ───────────── Browse ───────────── */

/** The browse filters as a query — shared by the browse page and saved searches, so both agree on what matches. */
export function browseFilter(criteria: SearchCriteria): QueryFilter<ListingDoc> {
  const filter: QueryFilter<ListingDoc> = { status: { $in: BROWSE_STATUSES } };
  if (criteria.category) {
    filter.category = criteria.category;
    if (criteria.sub && isSubcategoryOf(criteria.category, criteria.sub)) filter.subcategory = criteria.sub;
  }
  if (criteria.region) filter.region = criteria.region;
  if (criteria.condition) filter.condition = criteria.condition;
  if (criteria.framework) filter['digital.framework'] = criteria.framework;
  if (criteria.shipping) filter.shipping = true;
  if (criteria.minPrice !== undefined || criteria.maxPrice !== undefined) {
    filter.price = {
      ...(criteria.minPrice !== undefined ? { $gte: criteria.minPrice } : {}),
      ...(criteria.maxPrice !== undefined ? { $lte: criteria.maxPrice } : {}),
    };
  }
  if (criteria.q) filter.$text = { $search: criteria.q };
  return filter;
}

export async function listListings(query: MarketListQuery): Promise<Page<ListingCard>> {
  const filter = browseFilter(query);
  if (query.seller) {
    const seller = await User.findOne({ usernameLower: query.seller.toLowerCase(), status: 'active' }).select('_id').lean<Pick<UserDoc, '_id'>>();
    if (!seller) return paginate([], 0, query.page, query.pageSize);
    filter.sellerId = seller._id;
  }

  // A search sorted by "Newest" still puts the best matches first.
  const sort: Record<string, SortOrder | { $meta: 'textScore' }> =
    query.sort === 'price-asc'
      ? { price: 1, bumpedAt: -1 }
      : query.sort === 'price-desc'
        ? { price: -1, bumpedAt: -1 }
        : query.q
          ? { score: { $meta: 'textScore' }, bumpedAt: -1 }
          : { bumpedAt: -1 };

  const find = Listing.find(filter, query.q ? { score: { $meta: 'textScore' } } : undefined);
  const [docs, total] = await Promise.all([
    find.sort(sort as Record<string, SortOrder>).skip(skipFor(query.page, query.pageSize)).limit(query.pageSize).lean<ListingDoc[]>(),
    Listing.countDocuments(filter),
  ]);
  return paginate(await toCards(docs), total, query.page, query.pageSize);
}

export async function categoryCounts(): Promise<MarketCategoryCount[]> {
  const rows = await Listing.aggregate<{ _id: MarketCategoryCount['category']; count: number }>([
    { $match: { status: { $in: BROWSE_STATUSES } } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  return rows.map((row) => ({ category: row._id, count: row.count }));
}

/** The paid row on top of the marketplace: a shuffled handful, so every boost gets seen. */
export async function featuredListings(category: string | undefined, limit = 4): Promise<ListingCard[]> {
  const match: QueryFilter<ListingDoc> = { status: 'active', featuredUntil: { $gt: new Date() } };
  if (category) match.category = category as ListingDoc['category'];
  const docs = await Listing.aggregate<ListingDoc>([{ $match: match }, { $sample: { size: limit } }]);
  return toCards(docs);
}

export async function latestListings(limit: number): Promise<ListingCard[]> {
  const docs = await Listing.find({ status: 'active' }).sort({ bumpedAt: -1 }).limit(limit).lean<ListingDoc[]>();
  return toCards(docs);
}

/* ───────────── One listing ───────────── */

async function sellerProfile(sellerId: Types.ObjectId): Promise<MarketSeller> {
  const [user, active, sold, reputation] = await Promise.all([
    User.findById(sellerId).select(`${USER_REF_FIELDS} region level createdAt`).lean<UserDoc>(),
    Listing.countDocuments({ sellerId, status: { $in: BROWSE_STATUSES } }),
    Listing.countDocuments({ sellerId, status: 'sold' }),
    reputationFor(sellerId),
  ]);
  if (!user) throw AppError.notFound('Listing');
  return {
    id: String(user._id),
    username: user.username,
    displayName: user.displayName,
    avatarColor: user.avatarColor,
    avatarUrl: avatarUrlOf(user),
    region: user.region,
    level: user.level,
    joinedAt: user.createdAt.toISOString(),
    activeListings: active,
    soldListings: sold,
    reputation,
  };
}

async function findPublic(id: string): Promise<ListingDoc> {
  const doc = await Listing.findOne({ _id: id, status: { $in: PUBLIC_STATUSES } }).lean<ListingDoc>();
  if (!doc) throw AppError.notFound('Listing');
  return doc;
}

async function detailOf(doc: ListingDoc): Promise<ListingDetail> {
  const [media, seller, saves] = await Promise.all([
    mediaByIds(doc.photoIds),
    sellerProfile(doc.sellerId),
    Bookmark.countDocuments({ targetType: 'listing', targetId: doc._id }),
  ]);
  return toListingDetail(doc, media, seller, saves);
}

export async function getListing(id: string): Promise<ListingDetail> {
  return detailOf(await findPublic(id));
}

function renewableAt(doc: Pick<ListingDoc, 'status' | 'bumpedAt'>): string | null {
  if (doc.status !== 'active') return null;
  const next = doc.bumpedAt.getTime() + RENEW_COOLDOWN_MS;
  return next > Date.now() ? new Date(next).toISOString() : null;
}

export async function viewerState(listingId: string, userId: string | null): Promise<ListingViewerState> {
  const doc = await findPublic(listingId);
  if (!userId) return { isOwner: false, saved: false, reported: false, conversationId: null, renewableAt: null, canRate: false, myRating: null, buyers: [] };
  const isOwner = String(doc.sellerId) === userId;
  const [saved, reported, conversation, rating, buyers] = await Promise.all([
    Bookmark.exists({ userId, targetType: 'listing', targetId: doc._id }),
    ListingReport.exists({ listingId: doc._id, reporterId: userId }),
    isOwner ? null : Conversation.findOne({ listingId: doc._id, buyerId: userId }).select('_id').lean(),
    isOwner ? { canRate: false, myRating: null } : ratingStateFor(doc, userId),
    isOwner ? chatBuyers(doc._id) : [],
  ]);
  return {
    isOwner,
    saved: Boolean(saved),
    reported: Boolean(reported),
    conversationId: conversation ? String(conversation._id) : null,
    renewableAt: isOwner ? renewableAt(doc) : null,
    ...rating,
    buyers,
  };
}

/** Everyone who messaged about a listing — the candidates for "Who bought it?". */
async function chatBuyers(listingId: Types.ObjectId) {
  const conversations = await Conversation.find({ listingId }).sort({ lastMessageAt: -1 }).limit(50).select('buyerId').lean();
  const users = await User.find({ _id: { $in: conversations.map((c) => c.buyerId) }, status: 'active' }).select(USER_REF_FIELDS).lean<SellerSource[]>();
  const byId = new Map(users.map((user) => [String(user._id), toSellerRef(user)]));
  return conversations.flatMap((c) => byId.get(String(c.buyerId)) ?? []);
}

/** Unique signed-in views per day; sellers looking at their own listing don't count. */
export async function recordListingView(listingId: string, userId: string): Promise<void> {
  const doc = await findPublic(listingId);
  if (String(doc.sellerId) === userId) return;
  if (await recordView(userId, 'listing', listingId)) {
    await Listing.updateOne({ _id: doc._id }, { $inc: { views: 1 } });
  }
}

/* ───────────── Selling ───────────── */

/** Drops fields that don't apply to the listing's kind, so stale form values never persist. */
function normalize(input: ListingInput) {
  const digital = isDigitalCategory(input.category);
  return {
    title: input.title,
    description: input.description,
    category: input.category,
    // Already validated by the schema; the guard narrows the type.
    subcategory: input.subcategory && isSubcategoryOf(input.category, input.subcategory) ? input.subcategory : null,
    price: input.price,
    negotiable: input.negotiable,
    openToTrades: input.openToTrades,
    condition: digital ? null : input.condition,
    region: input.region,
    area: input.area,
    meetup: digital ? false : input.meetup,
    shipping: digital ? false : input.shipping,
    digital:
      digital && input.digital
        ? {
            framework: input.category === 'fivem' ? input.digital.framework : null,
            delivery: input.digital.delivery,
            source: input.digital.source,
          }
        : null,
  };
}

/** Photos must be the seller's own uploads and not already on another listing. */
async function resolvePhotos(sellerId: string, ids: string[], listingId: Types.ObjectId | null) {
  const media = await ownedMedia(sellerId, ids);
  const taken = media.some((doc) => doc.attachedTo && (!listingId || !doc.attachedTo.equals(listingId)));
  if (taken) {
    const message = 'A photo is already used on another listing — upload it again';
    throw AppError.unprocessable(message, { fields: { photoIds: message } });
  }
  return media.map((doc) => doc._id);
}

export async function createListing(sellerId: string, input: ListingInput): Promise<ListingDetail> {
  const open = await Listing.countDocuments({ sellerId, status: { $in: BROWSE_STATUSES } });
  if (open >= MAX_OPEN_LISTINGS) {
    throw AppError.unprocessable(`You can have up to ${MAX_OPEN_LISTINGS} open listings — mark sold items as sold first`);
  }
  const photoIds = await resolvePhotos(sellerId, input.photoIds, null);
  const doc = await Listing.create({ ...normalize(input), sellerId, photoIds, status: 'active', bumpedAt: new Date() });
  await attachMedia(photoIds, doc._id);
  bus.emit('market.listing_published', {
    listingId: String(doc._id),
    sellerId,
    title: doc.title,
    price: doc.price,
    photoUrl: photoIds[0] ? mediaUrl(photoIds[0], 'thumb') : null,
  });
  return getListing(String(doc._id));
}

async function ownListing(sellerId: string, id: string): Promise<ListingDoc> {
  const doc = await Listing.findOne({ _id: id, sellerId, status: { $ne: 'deleted' } }).lean<ListingDoc>();
  if (!doc) throw AppError.notFound('Listing');
  if (doc.status === 'removed') throw AppError.forbidden('This listing was removed by moderators and can no longer be changed');
  return doc;
}

export async function updateListing(sellerId: string, id: string, input: ListingInput): Promise<ListingDetail> {
  const doc = await ownListing(sellerId, id);
  const photoIds = await resolvePhotos(sellerId, input.photoIds, doc._id);
  const kept = new Set(photoIds.map(String));
  const dropped = doc.photoIds.filter((photoId) => !kept.has(String(photoId)));

  await Listing.updateOne({ _id: doc._id }, { $set: { ...normalize(input), photoIds } });
  await Promise.all([attachMedia(photoIds, doc._id), detachMedia(dropped)]);
  return getListing(id);
}

export async function setListingStatus(sellerId: string, id: string, status: SellerListingStatus, buyerId?: string | null): Promise<MyListing> {
  const doc = await ownListing(sellerId, id);
  let buyer: Types.ObjectId | null = null;
  if (status === 'sold' && buyerId) {
    // Only someone who actually talked to the seller about this item can be named the buyer.
    const conversation = await Conversation.exists({ listingId: doc._id, buyerId });
    if (!conversation) throw AppError.unprocessable('Pick a buyer from the players who messaged you about this item');
    buyer = toObjectId(buyerId);
  } else if (status === 'sold' && buyerId === undefined) {
    buyer = doc.buyerId ?? null;
  }
  await Listing.updateOne(
    { _id: doc._id },
    { $set: { status, soldAt: status === 'sold' ? (doc.soldAt ?? new Date()) : null, buyerId: status === 'sold' ? buyer : null } },
  );
  if (buyer && String(buyer) !== String(doc.buyerId ?? '')) {
    const seller = await User.findById(sellerId).select('displayName').lean<Pick<UserDoc, 'displayName'>>();
    bus.emit('market.sold_to', { listingId: id, title: doc.title, sellerId, sellerName: seller?.displayName ?? 'The seller', buyerId: String(buyer) });
  }
  await refreshSellerBadge(sellerId);
  return myListing(sellerId, id);
}

export async function renewListing(sellerId: string, id: string): Promise<MyListing> {
  const doc = await ownListing(sellerId, id);
  if (doc.status !== 'active') throw AppError.unprocessable('Only active listings can be renewed');
  const next = renewableAt(doc);
  if (next) throw AppError.unprocessable('You renewed this listing recently', { renewableAt: next });
  await Listing.updateOne({ _id: doc._id }, { $set: { bumpedAt: new Date() } });
  return myListing(sellerId, id);
}

export async function deleteListing(sellerId: string, id: string): Promise<void> {
  const doc = await Listing.findOne({ _id: id, sellerId, status: { $ne: 'deleted' } }).lean<ListingDoc>();
  if (!doc) throw AppError.notFound('Listing');
  // Soft delete: conversations about it keep their context.
  await Listing.updateOne({ _id: doc._id }, { $set: { status: 'deleted' } });
  await detachMedia(doc.photoIds);
  bus.emit('market.listing_withdrawn', { listingId: id });
}

async function toMyListings(sellerId: string, docs: ListingDoc[]): Promise<MyListing[]> {
  const ids = docs.map((doc) => doc._id);
  const buyerIds = docs.flatMap((doc) => (doc.buyerId ? [doc.buyerId] : []));
  const [cards, saves, threads, buyers] = await Promise.all([
    toCards(docs),
    Bookmark.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { targetType: 'listing', targetId: { $in: ids } } },
      { $group: { _id: '$targetId', count: { $sum: 1 } } },
    ]),
    Conversation.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { listingId: { $in: ids }, sellerId: toObjectId(sellerId) } },
      { $group: { _id: '$listingId', count: { $sum: 1 } } },
    ]),
    buyerIds.length > 0 ? User.find({ _id: { $in: buyerIds } }).select(USER_REF_FIELDS).lean<SellerSource[]>() : [],
  ]);
  const buyerById = new Map(buyers.map((user) => [String(user._id), toSellerRef(user)]));
  const saveCount = new Map(saves.map((row) => [String(row._id), row.count]));
  const threadCount = new Map(threads.map((row) => [String(row._id), row.count]));
  return docs.map((doc, index) => ({
    ...cards[index]!,
    views: doc.views,
    saves: saveCount.get(String(doc._id)) ?? 0,
    conversations: threadCount.get(String(doc._id)) ?? 0,
    renewableAt: renewableAt(doc),
    moderationNote: doc.status === 'removed' ? doc.moderationNote : null,
    buyer: doc.buyerId ? (buyerById.get(String(doc.buyerId)) ?? null) : null,
    featuredUntil: doc.featuredUntil && doc.featuredUntil.getTime() > Date.now() ? doc.featuredUntil.toISOString() : null,
  }));
}

async function myListing(sellerId: string, id: string): Promise<MyListing> {
  const doc = await Listing.findOne({ _id: id, sellerId }).lean<ListingDoc>();
  if (!doc) throw AppError.notFound('Listing');
  const [item] = await toMyListings(sellerId, [doc]);
  return item!;
}

export async function myListings(sellerId: string, status?: SellerListingStatus): Promise<MyListings> {
  const filter: QueryFilter<ListingDoc> = { sellerId, status: status ? status : { $ne: 'deleted' } };
  const [docs, counts] = await Promise.all([
    Listing.find(filter).sort({ bumpedAt: -1 }).limit(200).lean<ListingDoc[]>(),
    Listing.aggregate<{ _id: ListingStatus; count: number }>([
      { $match: { sellerId: toObjectId(sellerId), status: { $in: ['active', 'pending', 'sold'] } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);
  const byStatus = new Map(counts.map((row) => [row._id, row.count]));
  return {
    items: await toMyListings(sellerId, docs),
    counts: { active: byStatus.get('active') ?? 0, pending: byStatus.get('pending') ?? 0, sold: byStatus.get('sold') ?? 0 },
  };
}

export async function savedListings(userId: string): Promise<ListingCard[]> {
  const ids = await bookmarkIds(userId, 'listing');
  if (ids.length === 0) return [];
  const docs = await Listing.find({ _id: { $in: ids }, status: { $in: PUBLIC_STATUSES } }).lean<ListingDoc[]>();
  const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
  // Most recently saved first.
  return toCards(ids.map((id) => byId.get(id)).filter((doc): doc is ListingDoc => Boolean(doc)));
}
