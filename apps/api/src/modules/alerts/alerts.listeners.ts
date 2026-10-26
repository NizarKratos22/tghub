import { titleForLevel } from '@tgh/shared';
import { bus } from '../../core/events/bus';
import { refreshSellerBadge } from '../market/reputation.service';
import { alertMatchingSearches } from '../market/searches.service';
import { publishAlert } from './alerts.service';
import { ensurePreferences, followGame } from './preferences.service';
import { ensureSteamNewsSource } from './sources/sources.service';

export function registerAlertListeners(): void {
  bus.on('user.registered', ({ userId }) => ensurePreferences(userId));

  // Favouriting a game means you want its patch notes.
  bus.on('game.favorited', ({ userId, gameId }) => followGame(userId, gameId));

  // A new game on Steam gets its own Radar feed.
  bus.on('game.on_steam', ({ gameId }) => ensureSteamNewsSource(gameId));

  bus.on('progression.level_up', ({ userId, level }) =>
    publishAlert(
      {
        category: 'social',
        title: `Level ${level} reached`,
        summary: `You're now level ${level} — ${titleForLevel(level)}.`,
        url: '/universe',
        gameId: null,
        sourceName: 'TG Hub Universe',
        dedupKey: `levelup:${userId}:${level}`,
      },
      { recipients: [userId] },
    ),
  );

  bus.on('achievement.unlocked', ({ userId, code, title, xpReward }) =>
    publishAlert(
      {
        category: 'social',
        title: `Achievement unlocked: ${title}`,
        summary: xpReward > 0 ? `+${xpReward} XP added to your profile.` : 'Added to your profile.',
        url: '/universe',
        gameId: null,
        sourceName: 'TG Hub Universe',
        dedupKey: `ach:${userId}:${code}`,
      },
      { recipients: [userId] },
    ),
  );

  // Sellers hear about a new buyer once per thread; the rest of the chat lives in Messages.
  bus.on('market.conversation_started', ({ conversationId, sellerId, listingTitle }) =>
    publishAlert(
      {
        category: 'social',
        title: `New message about "${listingTitle}"`,
        summary: 'A player is interested in your listing. Reply from your marketplace inbox.',
        url: `/market/inbox/${conversationId}`,
        gameId: null,
        sourceName: 'TG Hub Marketplace',
        dedupKey: `market:conversation:${conversationId}`,
      },
      { recipients: [sellerId] },
    ),
  );

  bus.on('market.sold_to', ({ listingId, title, sellerName, buyerId }) =>
    publishAlert(
      {
        category: 'social',
        title: `How was buying "${title}" from ${sellerName}?`,
        summary: 'Rate the sale — it helps other players know who they can trust.',
        url: `/market/item/${listingId}#rate`,
        gameId: null,
        sourceName: 'TG Hub Marketplace',
        dedupKey: `market:sold:${listingId}:${buyerId}`,
      },
      { recipients: [buyerId] },
    ),
  );

  bus.on('market.rated', ({ listingId, title, sellerId, buyerName, stars }) =>
    publishAlert(
      {
        category: 'social',
        title: `${buyerName} rated you ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}`,
        summary: `For "${title}". You can reply once from your profile.`,
        url: `/market/item/${listingId}`,
        gameId: null,
        sourceName: 'TG Hub Marketplace',
        dedupKey: `market:rated:${listingId}`,
      },
      { recipients: [sellerId] },
    ),
  );

  bus.on('market.listing_removed', ({ sellerId }) => refreshSellerBadge(sellerId));

  bus.on('market.listing_published', ({ listingId }) => alertMatchingSearches(listingId));

  bus.on('market.featured', ({ listingId, title, sellerId, until }) =>
    publishAlert(
      {
        category: 'social',
        title: `“${title}” is featured`,
        summary: `It shows in the featured row with a Featured badge until ${new Date(until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Tunis' })}.`,
        url: `/market/item/${listingId}`,
        gameId: null,
        sourceName: 'TG Hub Marketplace',
        dedupKey: `market:featured:${listingId}:${until}`,
      },
      { recipients: [sellerId] },
    ),
  );

  bus.on('social.followed', ({ followerId, followerName, followerUsername, followeeId }) =>
    publishAlert(
      {
        category: 'social',
        title: `${followerName} started following you`,
        summary: 'Your level-ups, listings and clan moves now show up in their feed.',
        url: `/u/${followerUsername}`,
        gameId: null,
        sourceName: 'TG Hub',
        // Unfollow + follow again doesn't notify twice.
        dedupKey: `follow:${followerId}:${followeeId}`,
      },
      { recipients: [followeeId] },
    ),
  );

  /* Squads: every step of joining someone reaches the people involved. */

  bus.on('clan.application', ({ clanTag, clanName, requestId, applicantName, recipientIds }) =>
    publishAlert(
      {
        category: 'social',
        title: `${applicantName} wants to join [${clanTag}] ${clanName}`,
        summary: 'Accept or decline from the clan page.',
        url: `/clans/${clanTag}`,
        gameId: null,
        sourceName: 'TG Hub Clans',
        dedupKey: `clan:application:${requestId}`,
      },
      { recipients: recipientIds },
    ),
  );

  bus.on('clan.application_decided', ({ clanTag, clanName, userId, accepted }) =>
    publishAlert(
      {
        category: 'social',
        title: accepted ? `You're in! Welcome to [${clanTag}] ${clanName}` : `[${clanTag}] ${clanName} didn't accept your application`,
        summary: accepted ? 'Your XP now counts toward the clan standings.' : 'Plenty of other clans are recruiting.',
        url: accepted ? `/clans/${clanTag}` : '/clans?recruiting=true',
        gameId: null,
        sourceName: 'TG Hub Clans',
        dedupKey: `clan:decision:${clanTag}:${userId}:${Date.now()}`,
      },
      { recipients: [userId] },
    ),
  );

  bus.on('clan.member_removed', ({ clanTag, clanName, userId }) =>
    publishAlert(
      {
        category: 'social',
        title: `You were removed from [${clanTag}] ${clanName}`,
        summary: 'You can join or create another clan any time.',
        url: '/clans',
        gameId: null,
        sourceName: 'TG Hub Clans',
        dedupKey: `clan:removed:${clanTag}:${userId}:${Date.now()}`,
      },
      { recipients: [userId] },
    ),
  );

  bus.on('lfg.application', ({ postId, authorId, applicantName, gameTitle, requestId }) =>
    publishAlert(
      {
        category: 'social',
        title: `${applicantName} wants to join your ${gameTitle} squad`,
        summary: 'Accept to share your contact with them.',
        url: `/squads/${postId}`,
        gameId: null,
        sourceName: 'TG Hub Squads',
        dedupKey: `lfg:application:${requestId}`,
      },
      { recipients: [authorId] },
    ),
  );

  bus.on('lfg.application_decided', ({ postId, userId, accepted, gameTitle, authorName }) =>
    publishAlert(
      {
        category: 'social',
        title: accepted ? `${authorName} accepted you for ${gameTitle}` : `Your ${gameTitle} squad request wasn't accepted`,
        summary: accepted ? "Open the post to see how to reach them — don't keep the squad waiting." : 'Other squads are looking for players right now.',
        url: accepted ? `/squads/${postId}` : '/squads',
        gameId: null,
        sourceName: 'TG Hub Squads',
        dedupKey: `lfg:decision:${postId}:${userId}`,
      },
      { recipients: [userId] },
    ),
  );

  bus.on('market.listing_removed', ({ listingId, sellerId, title, note }) =>
    publishAlert(
      {
        category: 'social',
        title: `Your listing "${title}" was removed`,
        summary: note || 'It broke the marketplace rules. Contact support if you think this is a mistake.',
        url: '/market/selling',
        gameId: null,
        sourceName: 'TG Hub Marketplace',
        dedupKey: `market:removed:${listingId}`,
      },
      { recipients: [sellerId] },
    ),
  );

  bus.on('pulse.milestone', ({ pulseKey, pulseTitle, threshold, label, reward }) =>
    publishAlert({
      category: 'announcement',
      title: `The Pulse hit ${label}`,
      summary: `${pulseTitle}: the community unlocked "${reward}".`,
      url: '/universe',
      gameId: null,
      sourceName: 'TG Hub Universe',
      dedupKey: `pulse:${pulseKey}:${threshold}`,
    }),
  );
}
