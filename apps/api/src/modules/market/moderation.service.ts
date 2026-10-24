import type { QueryFilter, Types } from 'mongoose';
import {
  MARKET_REPORT_FLAG_THRESHOLD,
  type AdminListing,
  type AdminListingReport,
  type AdminListingUpdateInput,
  type ListingReportInput,
  type ListingStatus,
  type MarketReportReason,
  type Page,
} from '@tgh/shared';
import { bus } from '../../core/events/bus';
import { AppError, isDuplicateKeyError } from '../../core/http/errors';
import { paginate, skipFor } from '../../core/http/utils';
import { User } from '../users/user.model';
import { USER_REF_FIELDS } from '../users/users.mapper';
import { GONE_USER, toSellerRef, type SellerSource } from './market.mapper';
import { Listing, ListingReport, type ListingDoc, type ListingReportDoc } from './market.model';
import { PUBLIC_STATUSES, toCards } from './listings.service';

/** One report per player per listing; enough distinct reports put it in the moderation queue. */
export async function reportListing(userId: string, listingId: string, input: ListingReportInput): Promise<void> {
  const listing = await Listing.findOne({ _id: listingId, status: { $in: PUBLIC_STATUSES } }).select('sellerId').lean<Pick<ListingDoc, '_id' | 'sellerId'>>();
  if (!listing) throw AppError.notFound('Listing');
  if (String(listing.sellerId) === userId) throw AppError.unprocessable("You can't report your own listing");
  try {
    await ListingReport.create({ listingId: listing._id, reporterId: userId, reason: input.reason, details: input.details });
  } catch (error) {
    if (isDuplicateKeyError(error)) return; // already reported — idempotent
    throw error;
  }
  const updated = await Listing.findOneAndUpdate({ _id: listing._id }, { $inc: { reportCount: 1 } }, { returnDocument: 'after' })
    .select('reportCount flagged')
    .lean<Pick<ListingDoc, 'reportCount' | 'flagged'>>();
  if (updated && !updated.flagged && updated.reportCount >= MARKET_REPORT_FLAG_THRESHOLD) {
    await Listing.updateOne({ _id: listing._id }, { $set: { flagged: true } });
  }
}

async function users(ids: Types.ObjectId[]) {
  const docs = await User.find({ _id: { $in: ids } }).select(USER_REF_FIELDS).lean<SellerSource[]>();
  return new Map(docs.map((doc) => [String(doc._id), toSellerRef(doc)]));
}

async function toAdminListings(docs: ListingDoc[]): Promise<AdminListing[]> {
  const ids = docs.map((doc) => doc._id);
  const [cards, sellers, reasons] = await Promise.all([
    toCards(docs),
    users(docs.map((doc) => doc.sellerId)),
    ListingReport.aggregate<{ _id: Types.ObjectId; reasons: MarketReportReason[] }>([
      { $match: { listingId: { $in: ids } } },
      { $group: { _id: '$listingId', reasons: { $addToSet: '$reason' } } },
    ]),
  ]);
  const reasonsById = new Map(reasons.map((row) => [String(row._id), row.reasons]));
  return docs.map((doc, index) => ({
    ...cards[index]!,
    seller: sellers.get(String(doc.sellerId)) ?? GONE_USER,
    flagged: doc.flagged,
    reports: doc.reportCount,
    reportReasons: reasonsById.get(String(doc._id)) ?? [],
    moderationNote: doc.moderationNote,
    updatedAt: doc.updatedAt.toISOString(),
  }));
}

export async function adminListListings(query: {
  q?: string;
  status?: ListingStatus;
  flagged?: boolean;
  page: number;
  pageSize: number;
}): Promise<Page<AdminListing>> {
  const filter: QueryFilter<ListingDoc> = {};
  if (query.status) filter.status = query.status;
  if (query.flagged !== undefined) filter.flagged = query.flagged;
  if (query.q) filter.$text = { $search: query.q };
  // Flagged first, then the most reported, then the newest.
  const [docs, total] = await Promise.all([
    Listing.find(filter)
      .sort({ flagged: -1, reportCount: -1, createdAt: -1 })
      .skip(skipFor(query.page, query.pageSize))
      .limit(query.pageSize)
      .lean<ListingDoc[]>(),
    Listing.countDocuments(filter),
  ]);
  return paginate(await toAdminListings(docs), total, query.page, query.pageSize);
}

export async function adminUpdateListing(id: string, input: AdminListingUpdateInput): Promise<AdminListing> {
  const doc = await Listing.findById(id).lean<ListingDoc>();
  if (!doc || doc.status === 'deleted') throw AppError.notFound('Listing');

  const set: Partial<Pick<ListingDoc, 'status' | 'moderationNote' | 'flagged'>> = {};
  if (input.status === 'removed') {
    set.status = 'removed';
    set.flagged = false;
    set.moderationNote = input.moderationNote ?? doc.moderationNote ?? 'Removed for breaking the marketplace rules';
  } else if (input.status === 'active') {
    set.status = 'active';
    set.moderationNote = null;
    set.flagged = false;
  }
  if (input.flagged !== undefined) set.flagged = input.flagged;
  if (input.moderationNote !== undefined && input.status !== 'active') set.moderationNote = input.moderationNote;

  const updated = await Listing.findOneAndUpdate({ _id: doc._id }, { $set: set }, { returnDocument: 'after' }).lean<ListingDoc>();
  if (!updated) throw AppError.notFound('Listing');
  if (doc.status !== 'removed' && updated.status === 'removed') {
    bus.emit('market.listing_removed', {
      listingId: String(doc._id),
      sellerId: String(doc.sellerId),
      title: doc.title,
      note: updated.moderationNote ?? '',
    });
  }
  const [item] = await toAdminListings([updated]);
  return item!;
}

export async function recentListingsForAdmin(limit: number): Promise<AdminListing[]> {
  const docs = await Listing.find({ status: { $ne: 'deleted' } }).sort({ createdAt: -1 }).limit(limit).lean<ListingDoc[]>();
  return toAdminListings(docs);
}

export async function adminListingReports(listingId: string): Promise<AdminListingReport[]> {
  const reports = await ListingReport.find({ listingId }).sort({ createdAt: -1 }).limit(100).lean<ListingReportDoc[]>();
  const reporters = await users(reports.map((report) => report.reporterId));
  return reports.map((report) => ({
    id: String(report._id),
    reason: report.reason,
    details: report.details,
    reporter: reporters.get(String(report.reporterId)) ?? GONE_USER,
    createdAt: report.createdAt.toISOString(),
  }));
}

export async function marketOverview(): Promise<{ activeListings: number; flaggedListings: number }> {
  const [activeListings, flaggedListings] = await Promise.all([
    Listing.countDocuments({ status: 'active' }),
    Listing.countDocuments({ flagged: true, status: { $in: PUBLIC_STATUSES } }),
  ]);
  return { activeListings, flaggedListings };
}
