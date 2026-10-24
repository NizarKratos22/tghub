import type { Types } from 'mongoose';
import { RATING_EDIT_DAYS, SELLER_BADGE_RULES, type CursorPage, type SellerRatingInput, type SellerRating as SellerRatingDto, type SellerReputation } from '@tgh/shared';
import { bus } from '../../core/events/bus';
import { AppError } from '../../core/http/errors';
import { toObjectId } from '../../core/http/utils';
import { User, type UserDoc } from '../users/user.model';
import { toPlayerRef, USER_REF_FIELDS, type PlayerRefSource } from '../users/users.mapper';
import { GONE_USER } from './market.mapper';
import { Listing, SellerRating, type ListingDoc, type SellerRatingDoc } from './market.model';

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE = 10;

/* ───────────── Reputation ───────────── */

export async function reputationFor(sellerId: string | Types.ObjectId): Promise<SellerReputation> {
  const id = toObjectId(String(sellerId));
  const [rows, sales, user] = await Promise.all([
    SellerRating.aggregate<{ _id: number; n: number }>([{ $match: { sellerId: id } }, { $group: { _id: '$stars', n: { $sum: 1 } } }]),
    Listing.countDocuments({ sellerId: id, status: 'sold', buyerId: { $ne: null } }),
    User.findById(id).select('sellerVerified').lean<Pick<UserDoc, 'sellerVerified'>>(),
  ]);
  const distribution: SellerReputation['distribution'] = [0, 0, 0, 0, 0];
  for (const row of rows) if (row._id >= 1 && row._id <= 5) distribution[row._id - 1] = row.n;
  const count = distribution.reduce((sum, n) => sum + n, 0);
  const total = distribution.reduce((sum, n, index) => sum + n * (index + 1), 0);
  return {
    average: count > 0 ? Math.round((total / count) * 10) / 10 : null,
    count,
    distribution,
    sales,
    verified: user?.sellerVerified === true,
  };
}

/**
 * Recomputes the verified badge from the rules, unless a moderator pinned it.
 * Cheap enough to run after every rating, sale or removal.
 */
export async function refreshSellerBadge(sellerId: string | Types.ObjectId): Promise<boolean> {
  const user = await User.findById(sellerId).select('sellerOverride emailVerifiedAt createdAt sellerVerified').lean<UserDoc>();
  if (!user) return false;
  let verified: boolean;
  if (user.sellerOverride === 'verified') verified = true;
  else if (user.sellerOverride === 'revoked') verified = false;
  else {
    const rules = SELLER_BADGE_RULES;
    const [reputation, recentRemovals] = await Promise.all([
      reputationFor(user._id),
      Listing.countDocuments({ sellerId: user._id, status: 'removed', updatedAt: { $gte: new Date(Date.now() - rules.cleanDays * DAY_MS) } }),
    ]);
    verified =
      user.emailVerifiedAt !== null &&
      Date.now() - user.createdAt.getTime() >= rules.minAccountDays * DAY_MS &&
      reputation.sales >= rules.minSales &&
      reputation.count >= rules.minRatings &&
      (reputation.average ?? 0) >= rules.minAverage &&
      recentRemovals === 0;
  }
  if (verified !== (user.sellerVerified === true)) await User.updateOne({ _id: user._id }, { $set: { sellerVerified: verified } });
  return verified;
}

/** Periodic pass: account age crosses the line without any event, so sellers with sales get rechecked. */
export async function refreshAllSellerBadges(): Promise<{ checked: number }> {
  const sellers = await Listing.distinct('sellerId', { status: 'sold', buyerId: { $ne: null } });
  const pinned = await User.find({ sellerVerified: true }).select('_id').lean();
  const ids = new Set([...sellers.map(String), ...pinned.map((u) => String(u._id))]);
  for (const id of ids) await refreshSellerBadge(id);
  return { checked: ids.size };
}

/* ───────────── Ratings ───────────── */

function toRatingDto(doc: SellerRatingDoc, buyer: PlayerRefSource | undefined, listing: Pick<ListingDoc, '_id' | 'title'> | undefined): SellerRatingDto {
  return {
    id: String(doc._id),
    stars: doc.stars,
    comment: doc.comment,
    buyer: buyer ? toPlayerRef(buyer) : GONE_USER,
    listing: { id: String(doc.listingId), title: listing?.title ?? 'Listing removed' },
    reply: doc.reply,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** Whether `userId` bought this listing and may (still) leave or change a rating. */
export async function ratingStateFor(listing: Pick<ListingDoc, '_id' | 'status' | 'buyerId'>, userId: string): Promise<{ canRate: boolean; myRating: { stars: number; comment: string } | null }> {
  if (listing.status !== 'sold' || !listing.buyerId || String(listing.buyerId) !== userId) return { canRate: false, myRating: null };
  const existing = await SellerRating.findOne({ listingId: listing._id }).lean<SellerRatingDoc>();
  const open = !existing || Date.now() - existing.createdAt.getTime() < RATING_EDIT_DAYS * DAY_MS;
  return { canRate: open, myRating: existing ? { stars: existing.stars, comment: existing.comment } : null };
}

export async function rateSeller(buyerId: string, listingId: string, input: SellerRatingInput): Promise<{ stars: number; comment: string }> {
  const listing = await Listing.findById(listingId).select('sellerId status buyerId title').lean<ListingDoc>();
  if (!listing) throw AppError.notFound('Listing');
  const state = await ratingStateFor(listing, buyerId);
  if (!state.canRate) {
    throw AppError.forbidden(state.myRating ? `Ratings can be changed for ${RATING_EDIT_DAYS} days` : 'Only the buyer the seller picked can rate this sale');
  }
  const isNew = !state.myRating;
  await SellerRating.updateOne(
    { listingId: listing._id },
    { $set: { stars: input.stars, comment: input.comment }, $setOnInsert: { sellerId: listing.sellerId, buyerId: toObjectId(buyerId), reply: null } },
    { upsert: true },
  );
  await refreshSellerBadge(listing.sellerId);
  if (isNew) {
    const buyer = await User.findById(buyerId).select('displayName').lean<Pick<UserDoc, 'displayName'>>();
    bus.emit('market.rated', { listingId, title: listing.title, sellerId: String(listing.sellerId), buyerName: buyer?.displayName ?? 'A buyer', stars: input.stars });
  }
  return { stars: input.stars, comment: input.comment };
}

export async function replyToRating(sellerId: string, ratingId: string, reply: string): Promise<SellerRatingDto> {
  const rating = await SellerRating.findById(ratingId).lean<SellerRatingDoc>();
  if (!rating || String(rating.sellerId) !== sellerId) throw AppError.notFound('Rating');
  if (rating.reply) throw AppError.conflict('You already replied to this rating');
  await SellerRating.updateOne({ _id: rating._id }, { $set: { reply } });
  const [buyer, listing] = await Promise.all([
    User.findById(rating.buyerId).select(USER_REF_FIELDS).lean<PlayerRefSource>(),
    Listing.findById(rating.listingId).select('title').lean<Pick<ListingDoc, '_id' | 'title'>>(),
  ]);
  return toRatingDto({ ...rating, reply }, buyer ?? undefined, listing ?? undefined);
}

/** Newest first; public on the seller's profile. */
export async function sellerRatings(username: string, before?: string): Promise<CursorPage<SellerRatingDto> & { reputation: SellerReputation }> {
  const seller = await User.findOne({ usernameLower: username.toLowerCase(), status: 'active' }).select('_id').lean();
  if (!seller) throw AppError.notFound('Player');
  const filter: Record<string, unknown> = { sellerId: seller._id };
  if (before) filter._id = { $lt: toObjectId(before) };
  const [docs, reputation] = await Promise.all([
    SellerRating.find(filter).sort({ _id: -1 }).limit(PAGE + 1).lean<SellerRatingDoc[]>(),
    reputationFor(seller._id),
  ]);
  const page = docs.slice(0, PAGE);
  const [buyers, listings] = await Promise.all([
    User.find({ _id: { $in: page.map((d) => d.buyerId) } }).select(USER_REF_FIELDS).lean<PlayerRefSource[]>(),
    Listing.find({ _id: { $in: page.map((d) => d.listingId) } }).select('title').lean<Array<Pick<ListingDoc, '_id' | 'title'>>>(),
  ]);
  const buyerById = new Map(buyers.map((b) => [String(b._id), b]));
  const listingById = new Map(listings.map((l) => [String(l._id), l]));
  return {
    reputation,
    items: page.map((doc) => toRatingDto(doc, buyerById.get(String(doc.buyerId)), listingById.get(String(doc.listingId)))),
    nextCursor: docs.length > PAGE ? String(page.at(-1)!._id) : null,
  };
}

export async function setSellerOverride(userId: string, override: 'auto' | 'verified' | 'revoked'): Promise<void> {
  const result = await User.updateOne({ _id: userId }, { $set: { sellerOverride: override } });
  if (result.matchedCount === 0) throw AppError.notFound('Player');
  await refreshSellerBadge(userId);
}
