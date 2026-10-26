import type { TrackableEvent } from '@tgh/shared';
import { logger } from '../logger';

/**
 * Domain events. Modules announce what happened; other modules decide what to
 * do about it. Today this runs in-process; the same contract can sit on top of
 * a queue (BullMQ, Redis Streams) when one API instance is no longer enough.
 */
export interface DomainEvents {
  'user.registered': { userId: string };
  'user.daily_login': { userId: string; day: string };
  'game.viewed': { userId: string; gameId: string };
  /** A catalogue game now has a Steam app id (imported, re-linked or synced from IGDB). */
  'game.on_steam': { gameId: string; steamAppId: number };
  'game.favorited': { userId: string; gameId: string };
  'pc.spec_saved': { userId: string; specId: string };
  'pc.compat_checked': { userId: string; gameId: string };
  'radar.searched': { userId: string; query: string };
  'tournament.followed': { userId: string; tournamentId: string };
  'progression.level_up': { userId: string; level: number; previousLevel: number };
  'achievement.unlocked': { userId: string; code: string; title: string; xpReward: number };
  'pulse.milestone': { pulseKey: string; pulseTitle: string; threshold: number; label: string; reward: string };
  'market.conversation_started': { conversationId: string; listingId: string; listingTitle: string; sellerId: string; buyerId: string };
  'market.listing_removed': { listingId: string; sellerId: string; title: string; note: string };
  'progression.xp_awarded': { userId: string; amount: number; seasonKey: string | null };
  'clan.application': { clanTag: string; clanName: string; requestId: string; applicantName: string; recipientIds: string[] };
  'clan.application_decided': { clanTag: string; clanName: string; userId: string; accepted: boolean };
  'clan.member_removed': { clanTag: string; clanName: string; userId: string };
  'lfg.application': { postId: string; authorId: string; applicantName: string; gameTitle: string; requestId: string };
  'lfg.application_decided': { postId: string; userId: string; accepted: boolean; gameTitle: string; authorName: string };
  'lfg.posted': { postId: string; userId: string; gameId: string; mode: string; slots: number };
  'clan.joined': { userId: string; clanTag: string; clanName: string; color: string; founded: boolean };
  'market.listing_published': { listingId: string; sellerId: string; title: string; price: number; photoUrl: string | null };
  /** The seller deleted it (moderator removals use market.listing_removed). */
  'market.listing_withdrawn': { listingId: string };
  'market.featured': { listingId: string; title: string; sellerId: string; until: string };
  'market.sold_to': { listingId: string; title: string; sellerId: string; sellerName: string; buyerId: string };
  'market.rated': { listingId: string; title: string; sellerId: string; buyerName: string; stars: number };
  'social.followed': { followerId: string; followerName: string; followerUsername: string; followeeId: string };
}

export type DomainEventName = keyof DomainEvents;
type Listener<K extends DomainEventName> = (payload: DomainEvents[K]) => unknown;

// Every trackable event must carry the acting user.
type AssertTrackable = DomainEvents[TrackableEvent] extends { userId: string } ? true : never;
const _trackableCheck: AssertTrackable = true;
void _trackableCheck;

class EventBus {
  private readonly listeners = new Map<DomainEventName, Array<Listener<never>>>();
  private readonly pending = new Set<Promise<unknown>>();

  on<K extends DomainEventName>(event: K, listener: Listener<K>): void {
    const list = this.listeners.get(event) ?? [];
    list.push(listener as Listener<never>);
    this.listeners.set(event, list);
  }

  /** Fire-and-forget: listeners run after the current request continues. */
  emit<K extends DomainEventName>(event: K, payload: DomainEvents[K]): void {
    for (const listener of this.listeners.get(event) ?? []) {
      const run: Promise<unknown> = Promise.resolve()
        .then(() => (listener as Listener<K>)(payload))
        .catch((err: unknown) => logger.error({ err, event }, 'Domain event listener failed'))
        .finally(() => this.pending.delete(run));
      this.pending.add(run);
    }
  }

  /** Resolves once in-flight listeners (and anything they emitted) have finished. */
  async drain(): Promise<void> {
    while (this.pending.size > 0) {
      await Promise.allSettled([...this.pending]);
    }
  }
}

export const bus = new EventBus();
