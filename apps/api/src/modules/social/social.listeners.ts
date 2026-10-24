import { bus } from '../../core/events/bus';
import { dayKey } from '../../core/time/periods';
import { gameRefMap } from '../games/games.service';
import { Activity } from './social.model';
import { recordActivity } from './social.service';

const LEVEL_GOLD = '#d18a00';

/** Turns what players do into feed lines. Every write is deduplicated, so replays are harmless. */
export function registerSocialListeners(): void {
  // A listing that's gone shouldn't keep advertising itself in feeds.
  const dropListing = ({ listingId }: { listingId: string }) => Activity.deleteMany({ dedupKey: `listing:${listingId}` });
  bus.on('market.listing_withdrawn', dropListing);
  bus.on('market.listing_removed', dropListing);

  bus.on('progression.level_up', ({ userId, level }) =>
    recordActivity({
      actorId: userId,
      type: 'level_up',
      text: `reached Level ${level}`,
      visual: { kind: 'mark', label: String(level), color: LEVEL_GOLD },
      dedupKey: `level:${userId}:${level}`,
    }),
  );

  bus.on('achievement.unlocked', ({ userId, code, title, xpReward }) =>
    recordActivity({
      actorId: userId,
      type: 'achievement',
      text: 'unlocked',
      target: { label: title, href: '/universe' },
      detail: xpReward > 0 ? `+${xpReward} XP` : null,
      dedupKey: `achievement:${userId}:${code}`,
    }),
  );

  bus.on('game.favorited', async ({ userId, gameId }) => {
    const game = (await gameRefMap([gameId])).get(gameId);
    if (!game) return;
    await recordActivity({
      actorId: userId,
      type: 'game_favorited',
      text: 'added a favourite:',
      target: { label: game.title, href: `/games/${game.slug}` },
      visual: { kind: 'mark', label: game.monogram, color: game.accent },
      dedupKey: `favorite:${userId}:${gameId}`,
    });
  });

  bus.on('market.listing_published', ({ listingId, sellerId, title, price, photoUrl }) =>
    recordActivity({
      actorId: sellerId,
      type: 'listing',
      text: 'is selling',
      target: { label: title, href: `/market/item/${listingId}` },
      detail: `${new Intl.NumberFormat('en-US').format(price)} TND`,
      visual: photoUrl ? { kind: 'image', url: photoUrl } : null,
      dedupKey: `listing:${listingId}`,
    }),
  );

  bus.on('clan.joined', ({ userId, clanTag, clanName, color, founded }) =>
    recordActivity({
      actorId: userId,
      type: founded ? 'clan_founded' : 'clan_joined',
      text: founded ? 'founded the clan' : 'joined',
      target: { label: `[${clanTag}] ${clanName}`, href: `/clans/${clanTag}` },
      visual: { kind: 'mark', label: clanTag, color },
      // Leaving and rejoining the same day is one event.
      dedupKey: `clan:${userId}:${clanTag}:${dayKey()}`,
    }),
  );

  bus.on('lfg.posted', async ({ postId, userId, gameId, mode, slots }) => {
    const game = (await gameRefMap([gameId])).get(gameId);
    if (!game) return;
    await recordActivity({
      actorId: userId,
      type: 'lfg_posted',
      text: `is looking for ${slots === 1 ? 'a teammate' : `${slots} players`} in`,
      target: { label: game.title, href: `/squads/${postId}` },
      detail: mode,
      visual: { kind: 'mark', label: game.monogram, color: game.accent },
      dedupKey: `lfg:${postId}`,
    });
  });
}
