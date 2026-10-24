import { model, Schema, type QueryFilter, type Types } from 'mongoose';
import {
  FIVEM_FRAMEWORK_LABELS,
  MARKET_CATEGORY_META,
  MARKET_CONDITION_LABELS,
  MARKET_SUBCATEGORY_LABELS,
  MAX_SAVED_SEARCHES,
  type MarketSubcategory,
  type SavedSearch as SavedSearchDto,
  type SavedSearchInput,
  type SearchCriteria,
} from '@tgh/shared';
import { AppError } from '../../core/http/errors';
import { logger } from '../../core/logger';
import { publishAlert } from '../alerts/alerts.service';
import { browseFilter } from './listings.service';
import { Listing, type ListingDoc } from './market.model';

/** One alert per saved search per this window, so a seller posting ten items doesn't ping ten times. */
const ALERT_GAP_MS = 15 * 60 * 1000;

export interface SavedSearchDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  criteria: SearchCriteria;
  notify: boolean;
  lastSeenAt: Date;
  lastNotifiedAt: Date | null;
  createdAt: Date;
}

const savedSearchSchema = new Schema<SavedSearchDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    criteria: { type: Schema.Types.Mixed, required: true },
    notify: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: () => new Date() },
    lastNotifiedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
);

savedSearchSchema.index({ userId: 1, createdAt: -1 });
// New-listing fan-out looks searches up by category first.
savedSearchSchema.index({ notify: 1, 'criteria.category': 1 });

export const SavedSearch = model<SavedSearchDoc>('SavedSearch', savedSearchSchema, 'saved_searches');

const price = (value: number) => `${new Intl.NumberFormat('en-US').format(value)} TND`;

/** "“rtx” · PC parts · under 1,500 TND · Sfax" — readable without opening it. */
export function describeSearch(criteria: SearchCriteria): string {
  const parts: string[] = [];
  if (criteria.q) parts.push(`“${criteria.q}”`);
  if (criteria.sub && criteria.sub in MARKET_SUBCATEGORY_LABELS) parts.push(MARKET_SUBCATEGORY_LABELS[criteria.sub as MarketSubcategory]);
  else if (criteria.category) parts.push(MARKET_CATEGORY_META[criteria.category].label);
  if (criteria.framework) parts.push(FIVEM_FRAMEWORK_LABELS[criteria.framework]);
  if (criteria.condition) parts.push(MARKET_CONDITION_LABELS[criteria.condition]);
  if (criteria.minPrice !== undefined && criteria.maxPrice !== undefined) parts.push(`${price(criteria.minPrice)}–${price(criteria.maxPrice)}`);
  else if (criteria.maxPrice !== undefined) parts.push(`under ${price(criteria.maxPrice)}`);
  else if (criteria.minPrice !== undefined) parts.push(`over ${price(criteria.minPrice)}`);
  if (criteria.region) parts.push(criteria.region);
  if (criteria.shipping) parts.push('ships');
  return (parts.join(' · ') || 'All listings').slice(0, 60);
}

/** Drops empty values so stored criteria compare and render cleanly. */
function clean(criteria: SearchCriteria): SearchCriteria {
  return Object.fromEntries(Object.entries(criteria).filter(([, value]) => value !== undefined && value !== '')) as SearchCriteria;
}

async function toDto(doc: SavedSearchDoc): Promise<SavedSearchDto> {
  const newCount = await Listing.countDocuments({ ...browseFilter(doc.criteria), createdAt: { $gt: doc.lastSeenAt } });
  return {
    id: String(doc._id),
    name: doc.name,
    criteria: doc.criteria,
    notify: doc.notify,
    newCount,
    lastSeenAt: doc.lastSeenAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  };
}

export async function listSavedSearches(userId: string): Promise<SavedSearchDto[]> {
  const docs = await SavedSearch.find({ userId }).sort({ createdAt: -1 }).lean<SavedSearchDoc[]>();
  return Promise.all(docs.map(toDto));
}

export async function saveSearch(userId: string, input: SavedSearchInput): Promise<SavedSearchDto> {
  const criteria = clean(input.criteria);
  const existing = await SavedSearch.find({ userId }).select('criteria').lean<SavedSearchDoc[]>();
  // Saving the same filters twice just returns the one you have.
  const same = existing.find((doc) => JSON.stringify(clean(doc.criteria)) === JSON.stringify(criteria));
  if (same) return toDto((await SavedSearch.findById(same._id).lean<SavedSearchDoc>())!);
  if (existing.length >= MAX_SAVED_SEARCHES) throw AppError.unprocessable(`You can save up to ${MAX_SAVED_SEARCHES} searches — delete one first`);
  const doc = await SavedSearch.create({ userId, criteria, name: input.name ?? describeSearch(criteria), notify: input.notify });
  return toDto(doc.toObject());
}

async function ownSearch(userId: string, id: string): Promise<SavedSearchDoc> {
  const doc = await SavedSearch.findOne({ _id: id, userId }).lean<SavedSearchDoc>();
  if (!doc) throw AppError.notFound('Saved search');
  return doc;
}

export async function updateSavedSearch(userId: string, id: string, input: { name?: string; notify?: boolean }): Promise<SavedSearchDto> {
  await ownSearch(userId, id);
  const updated = await SavedSearch.findByIdAndUpdate(id, { $set: input }, { returnDocument: 'after' }).lean<SavedSearchDoc>();
  return toDto(updated!);
}

/** Opening a search clears its "new" count. */
export async function markSearchSeen(userId: string, id: string): Promise<SavedSearchDto> {
  await ownSearch(userId, id);
  const updated = await SavedSearch.findByIdAndUpdate(id, { $set: { lastSeenAt: new Date() } }, { returnDocument: 'after' }).lean<SavedSearchDoc>();
  return toDto(updated!);
}

export async function deleteSavedSearch(userId: string, id: string): Promise<void> {
  await SavedSearch.deleteOne({ _id: id, userId });
}

/**
 * A listing just went up: alert everyone whose saved search it matches. Cheap
 * fields narrow the candidates in the query; the real browse filter (text
 * search included) decides each match, so alerts agree with the browse page.
 */
export async function alertMatchingSearches(listingId: string): Promise<{ alerted: number }> {
  const listing = await Listing.findById(listingId).lean<ListingDoc>();
  if (!listing || listing.status !== 'active') return { alerted: 0 };

  const candidates = await SavedSearch.find({
    notify: true,
    userId: { $ne: listing.sellerId },
    $and: [
      { $or: [{ 'criteria.category': { $exists: false } }, { 'criteria.category': listing.category }] },
      { $or: [{ 'criteria.maxPrice': { $exists: false } }, { 'criteria.maxPrice': { $gte: listing.price } }] },
      { $or: [{ 'criteria.minPrice': { $exists: false } }, { 'criteria.minPrice': { $lte: listing.price } }] },
    ],
  } satisfies QueryFilter<SavedSearchDoc>).lean<SavedSearchDoc[]>();

  const notified = new Set<string>();
  const now = Date.now();
  for (const search of candidates) {
    const userId = String(search.userId);
    if (notified.has(userId)) continue;
    if (search.lastNotifiedAt && now - search.lastNotifiedAt.getTime() < ALERT_GAP_MS) continue;
    const matches = await Listing.exists({ _id: listing._id, ...browseFilter(search.criteria) });
    if (!matches) continue;
    notified.add(userId);
    await SavedSearch.updateOne({ _id: search._id }, { $set: { lastNotifiedAt: new Date() } });
    await publishAlert(
      {
        category: 'social',
        title: `New match: ${listing.title}`,
        summary: `${price(listing.price)}${listing.region ? ` · ${listing.region}` : ''} · from your saved search ${search.name}`,
        url: `/market/item/${listingId}`,
        gameId: null,
        sourceName: 'TG Hub Marketplace',
        dedupKey: `search:${String(search._id)}:${listingId}`,
      },
      { recipients: [userId] },
    ).catch((error: unknown) => logger.warn({ err: error }, 'Saved search alert failed'));
  }
  return { alerted: notified.size };
}
