import type { GameRef, Resource } from '@tgh/shared';
import { iso } from '../../core/http/utils';
import { gameArtMap, gameRefMap } from '../games/games.service';
import { igdbImage } from '../igdb/igdb.mapper';
import type { ResourceDoc } from './resource.model';

/** Small, stable number from an id, so a story always gets the same fallback shot. */
const pick = (id: string, size: number) => [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % size;

export function imageFor(doc: Pick<ResourceDoc, '_id' | 'imageUrl' | 'gameId'>, art: Map<string, string[]>): Resource['image'] {
  if (doc.imageUrl) return { url: doc.imageUrl, wideUrl: doc.imageUrl, fromGame: false };
  const shots = doc.gameId ? art.get(String(doc.gameId)) : undefined;
  if (!shots || shots.length === 0) return null;
  const shot = shots[pick(String(doc._id), shots.length)]!;
  return { url: igdbImage(shot, 'screenshot_big'), wideUrl: igdbImage(shot, '1080p'), fromGame: true };
}

export function toResource(doc: ResourceDoc, games: Map<string, GameRef>, now = new Date(), art: Map<string, string[]> = new Map()): Resource {
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
    image: imageFor(doc, art),
    isExpired: Boolean(doc.expiresAt && doc.expiresAt.getTime() < now.getTime()),
  };
}

export async function toResources(docs: ResourceDoc[]): Promise<Resource[]> {
  const gameIds = docs.map((doc) => doc.gameId);
  const [games, art] = await Promise.all([gameRefMap(gameIds), gameArtMap(gameIds)]);
  const now = new Date();
  return docs.map((doc) => toResource(doc, games, now, art));
}
