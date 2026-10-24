import type { GameRef, Resource } from '@tgh/shared';
import { iso } from '../../core/http/utils';
import { gameRefMap } from '../games/games.service';
import type { ResourceDoc } from './resource.model';

export function toResource(doc: ResourceDoc, games: Map<string, GameRef>, now = new Date()): Resource {
  const deal = doc.deal
    ? {
        store: doc.deal.store,
        price: doc.deal.price,
        originalPrice: doc.deal.originalPrice ?? null,
        currency: doc.deal.currency,
        discountPct:
          doc.deal.originalPrice && doc.deal.originalPrice > 0
            ? Math.round((1 - doc.deal.price / doc.deal.originalPrice) * 100)
            : null,
      }
    : null;

  return {
    id: String(doc._id),
    kind: doc.kind,
    title: doc.title,
    summary: doc.summary,
    url: doc.url,
    sourceName: doc.sourceName,
    game: doc.gameId ? (games.get(String(doc.gameId)) ?? null) : null,
    tags: doc.tags,
    publishedAt: doc.publishedAt.toISOString(),
    startsAt: iso(doc.startsAt),
    expiresAt: iso(doc.expiresAt),
    location: doc.location ?? null,
    deal,
    isExpired: Boolean(doc.expiresAt && doc.expiresAt.getTime() < now.getTime()),
  };
}

export async function toResources(docs: ResourceDoc[]): Promise<Resource[]> {
  const games = await gameRefMap(docs.map((doc) => doc.gameId));
  const now = new Date();
  return docs.map((doc) => toResource(doc, games, now));
}
