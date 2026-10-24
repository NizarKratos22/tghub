import type { ListingCard, ListingDetail, MarketMessage, MarketSeller, MarketSellerRef } from '@tgh/shared';
import type { MediaDoc } from '../media/media.model';
import { toPlayerRef } from '../users/users.mapper';
import { toPhoto } from '../media/media.service';
import type { UserDoc } from '../users/user.model';
import type { ListingDoc, MarketMessageDoc } from './market.model';

export type SellerSource = Pick<UserDoc, '_id' | 'username' | 'displayName' | 'avatarColor'> & Partial<Pick<UserDoc, 'avatarMediaId'>>;

export function toSellerRef(user: SellerSource): MarketSellerRef {
  return toPlayerRef(user);
}

/** Stand-in for accounts that no longer exist, so old threads still render. */
export const GONE_USER: MarketSellerRef = { id: '', username: '', displayName: 'Former member', avatarColor: '#62686d', avatarUrl: null };

export function coverOf(doc: Pick<ListingDoc, 'photoIds'>, media: Map<string, MediaDoc>) {
  const first = doc.photoIds[0];
  const cover = first ? media.get(String(first)) : undefined;
  return cover ? toPhoto(cover) : null;
}

export function toListingCard(doc: ListingDoc, media: Map<string, MediaDoc>): ListingCard {
  return {
    id: String(doc._id),
    title: doc.title,
    price: doc.price,
    category: doc.category,
    subcategory: doc.subcategory,
    digital: doc.digital !== null,
    condition: doc.condition,
    region: doc.region,
    shipping: doc.shipping,
    framework: doc.digital?.framework ?? null,
    status: doc.status,
    photo: coverOf(doc, media),
    createdAt: doc.createdAt.toISOString(),
    bumpedAt: doc.bumpedAt.toISOString(),
    featured: Boolean(doc.featuredUntil && doc.featuredUntil.getTime() > Date.now()),
  };
}

export function toListingDetail(doc: ListingDoc, media: Map<string, MediaDoc>, seller: MarketSeller, saves: number): ListingDetail {
  return {
    ...toListingCard(doc, media),
    description: doc.description,
    negotiable: doc.negotiable,
    openToTrades: doc.openToTrades,
    area: doc.area,
    meetup: doc.meetup,
    photos: doc.photoIds.flatMap((id) => {
      const photo = media.get(String(id));
      return photo ? [toPhoto(photo)] : [];
    }),
    digitalInfo: doc.digital ? { framework: doc.digital.framework, delivery: doc.digital.delivery, source: doc.digital.source } : null,
    seller,
    views: doc.views,
    saves,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toMessage(doc: MarketMessageDoc, viewerId: string): MarketMessage {
  return {
    id: String(doc._id),
    conversationId: String(doc.conversationId),
    senderId: String(doc.senderId),
    mine: String(doc.senderId) === viewerId,
    body: doc.body,
    createdAt: doc.createdAt.toISOString(),
  };
}
