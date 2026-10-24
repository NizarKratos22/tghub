/**
 * Development seed. Drops the configured database and rebuilds it with the
 * catalogue, hardware index, Season 1 and demo players. Refuses to run in production.
 *
 *   npm run seed                       # includes a live fetch of Steam news
 *   SEED_FETCH_FEEDS=false npm run seed # offline
 */
import { rm } from 'node:fs/promises';
import mongoose from 'mongoose';
import sharp from 'sharp';
import { AVATAR_COLORS, listingInputSchema } from '@tgh/shared';
import { env } from '../config/env';
import { hashPassword } from '../core/auth/password';
import { connectMongo, disconnectMongo } from '../core/db/mongo';
import { bus } from '../core/events/bus';
import '../core/events/once';
import { logger } from '../core/logger';
import { registerAlertListeners } from '../modules/alerts/alerts.listeners';
import { AlertSource } from '../modules/alerts/alerts.model';
import { publishAlert } from '../modules/alerts/alerts.service';
import { ensurePreferences, updatePreferences } from '../modules/alerts/preferences.service';
import { runSource } from '../modules/alerts/sources/sources.service';
import '../modules/auth/session.model';
import { Game, type RequirementTierDoc } from '../modules/games/game.model';
import { HardwareComponent } from '../modules/hardware/hardware.model';
import '../modules/library/library.model';
import { messageSeller, sendMessage } from '../modules/market/conversations.service';
import { createListing } from '../modules/market/listings.service';
import { Listing } from '../modules/market/market.model';
import { reportListing } from '../modules/market/moderation.service';
import { storeImage } from '../modules/media/media.service';
import { registerProgressionListeners } from '../modules/progression/progression.listeners';
import { Achievement, Mission, Pulse, XpLedger } from '../modules/progression/progression.model';
import { awardXp } from '../modules/progression/progression.service';
import { Resource } from '../modules/radar/resource.model';
import { faceitProvider } from '../modules/tournaments/providers/faceit.provider';
import { startggProvider } from '../modules/tournaments/providers/startgg.provider';
import { TournamentFollow, TournamentSource } from '../modules/tournaments/tournament.model';
import {
  announceTournament,
  loadGameMatcher,
  runSource as runTournamentSource,
  sendTournamentReminders,
  upsertTournament,
} from '../modules/tournaments/tournaments.sync';
import { User } from '../modules/users/user.model';
import { CPUS, GPUS, type ComponentSeed } from './data/components';
import { ACHIEVEMENTS, MISSIONS, PLAYERS, RESOURCES, SEASON, STEAM_SOURCES } from './data/content';
import { GAMES, type TierSeed } from './data/games';
import { CONVERSATIONS, LISTINGS } from './data/market';
import { seedSquads } from './squads';
import { registerSocialListeners } from '../modules/social/social.listeners';
import { follow } from '../modules/social/social.service';
import { registerSquadListeners } from '../modules/squads/squads.listeners';
import { listingArt } from './data/market-art';
import { SAMPLE_TOURNAMENTS } from './data/tournaments';

/** Local development accounts. Override with env vars; never reuse these anywhere real. */
const DEV_ADMIN = {
  email: 'admin@tghub.test',
  username: 'tgh_admin',
  password: process.env.SEED_ADMIN_PASSWORD ?? 'tghub-admin-dev',
};
const DEMO_PLAYER_PASSWORD = process.env.SEED_PLAYER_PASSWORD ?? 'tghub-player-dev';
const FETCH_FEEDS = process.env.SEED_FETCH_FEEDS !== 'false';

function componentDocs(type: 'cpu' | 'gpu', seeds: ComponentSeed[]) {
  return seeds.map((seed) => ({
    key: seed.key,
    type,
    brand: seed.brand,
    model: seed.model,
    series: seed.series,
    segment: seed.segment,
    score: seed.score,
    vramGb: seed.vramGb,
    releaseYear: seed.releaseYear,
    priceTnd: null,
    // Everything a player might type: "3050 laptop", "mobile", "igpu", "rtx40".
    searchText: [
      seed.brand,
      seed.model,
      seed.series,
      seed.key.replace(/-/g, ' '),
      seed.segment === 'laptop' ? 'laptop mobile notebook' : '',
      seed.segment === 'integrated' ? 'integrated igpu onboard' : '',
      ...seed.aliases,
    ]
      .join(' ')
      .toLowerCase(),
  }));
}

function resolveTier(tier: TierSeed | undefined, scores: Map<string, number>, slug: string): RequirementTierDoc | null {
  if (!tier) return null;
  const weakest = (keys: string[]) =>
    Math.min(
      ...keys.map((key) => {
        const score = scores.get(key);
        if (score === undefined) throw new Error(`${slug}: unknown component key "${key}"`);
        return score;
      }),
    );
  return {
    cpuLabel: tier.cpuLabel,
    gpuLabel: tier.gpuLabel,
    cpuScore: weakest(tier.cpu),
    gpuScore: weakest(tier.gpu),
    ramGb: tier.ramGb,
    vramGb: tier.vramGb ?? null,
    storageGb: tier.storageGb ?? null,
    os: tier.os ?? null,
  };
}

async function seed() {
  if (env.isProduction) {
    logger.error('Refusing to seed a production database');
    process.exit(1);
  }

  await connectMongo();
  await mongoose.connection.dropDatabase();
  // Uploaded files belong to the documents we just dropped.
  await rm(env.MEDIA_DIR, { recursive: true, force: true });
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).createIndexes()));
  logger.info('Database reset');

  /* Hardware index */
  const components = [...componentDocs('cpu', CPUS), ...componentDocs('gpu', GPUS)];
  await HardwareComponent.insertMany(components);
  const scores = new Map(components.map((c) => [c.key, c.score]));

  /* Catalogue */
  const games = await Game.insertMany(
    GAMES.map((game) => ({
      slug: game.slug,
      title: game.title,
      titleLower: game.title.toLowerCase(),
      monogram: game.monogram,
      tagline: game.tagline,
      description: game.description,
      genres: game.genres,
      platforms: game.platforms,
      modes: game.modes,
      developer: game.developer,
      publisher: game.publisher,
      releaseDate: game.releaseDate ? new Date(game.releaseDate) : null,
      freeToPlay: game.freeToPlay,
      accent: game.accent,
      aliases: game.aliases,
      tags: game.tags,
      languages: game.languages,
      steamAppId: game.steamAppId,
      links: game.links,
      requirements: {
        minimum: resolveTier(game.minimum, scores, game.slug),
        recommended: resolveTier(game.recommended, scores, game.slug),
        source: game.requirementsSource ?? null,
      },
      popularity: game.popularity,
      featured: game.featured ?? false,
    })),
  );
  const gameIds = new Map(games.map((game) => [game.slug, game._id]));

  /* Radar */
  await Resource.insertMany(
    RESOURCES.map((resource) => ({
      ...resource,
      titleLower: resource.title.toLowerCase(),
      gameId: resource.game ? gameIds.get(resource.game) : null,
      tags: resource.tags ?? [],
      startsAt: resource.startsAt ?? null,
      expiresAt: resource.expiresAt ?? null,
      location: resource.location ?? null,
      deal: resource.deal ?? null,
    })),
  );

  /* Universe */
  await Mission.insertMany(MISSIONS.map((mission) => ({ ...mission, startsAt: mission.startsAt ?? null, endsAt: mission.endsAt ?? null })));
  await Achievement.insertMany(ACHIEVEMENTS);
  await Pulse.create({ ...SEASON, current: 0 });
  logger.info({ components: components.length, games: games.length, resources: RESOURCES.length }, 'Catalogue seeded');

  /* Accounts — events flow through the real listeners, so XP, levels and alerts stay consistent. */
  registerProgressionListeners();
  registerAlertListeners();
  registerSquadListeners();
  registerSocialListeners();

  const [adminHash, playerHash] = await Promise.all([hashPassword(DEV_ADMIN.password), hashPassword(DEMO_PLAYER_PASSWORD)]);

  const admin = await User.create({
    email: DEV_ADMIN.email,
    username: DEV_ADMIN.username,
    usernameLower: DEV_ADMIN.username.toLowerCase(),
    displayName: 'TG Hub Admin',
    passwordHash: adminHash,
    emailVerifiedAt: new Date(),
    role: 'admin',
    country: 'TN',
    region: 'Tunis',
    avatarColor: AVATAR_COLORS[0],
  });
  await ensurePreferences(String(admin._id));

  const players = await User.insertMany(
    PLAYERS.map((player, index) => ({
      email: `${player.username.replace(/\./g, '-')}@demo.tghub.test`,
      username: player.username,
      usernameLower: player.username.toLowerCase(),
      displayName: player.username,
      passwordHash: playerHash,
      emailVerifiedAt: new Date(),
      country: player.country ?? 'TN',
      region: (player.country ?? 'TN') === 'TN' ? player.region : null,
      bio: player.bio,
      avatarColor: AVATAR_COLORS[index % AVATAR_COLORS.length],
    })),
  );

  for (const user of [admin, ...players]) {
    await ensurePreferences(String(user._id));
    bus.emit('user.registered', { userId: String(user._id) });
  }
  await bus.drain();

  // Demo players follow a few games so Steam patch notes land in their inbox.
  const followed = ['counter-strike-2', 'efootball', 'marvel-rivals'].map((slug) => String(gameIds.get(slug)));
  for (const user of [admin, ...players.slice(0, 4)]) {
    await updatePreferences(String(user._id), { followedGameIds: followed });
  }

  // Give the demo a history: players joined over the past weeks and earned their
  // warm-up XP in several sessions, so dashboards and leaderboards have a shape.
  const HISTORY_DAY = 86_400_000;
  const XP_SESSIONS = 6;
  await User.collection.updateOne({ _id: admin._id }, { $set: { createdAt: new Date(Date.now() - 70 * HISTORY_DAY) } });
  for (const [index, player] of PLAYERS.entries()) {
    const userId = players[index]!._id;
    const daysAgo = 52 - index * 4;
    const joined = Date.now() - daysAgo * HISTORY_DAY;
    await User.collection.updateOne({ _id: userId }, { $set: { createdAt: new Date(joined) } });
    const chunk = Math.floor(player.xp / XP_SESSIONS);
    for (let session = 0; session < XP_SESSIONS; session += 1) {
      const amount = session === XP_SESSIONS - 1 ? player.xp - chunk * (XP_SESSIONS - 1) : chunk;
      const key = `seed:${player.username}:${session}`;
      await awardXp(String(userId), amount, 'Season 1 warm-up', key);
      const earnedAt = joined + ((session + 1) * (daysAgo - 1) * HISTORY_DAY) / XP_SESSIONS;
      await XpLedger.collection.updateOne({ idempotencyKey: key }, { $set: { createdAt: new Date(earnedAt) } });
    }
  }
  await bus.drain();

  await publishAlert({
    category: 'announcement',
    title: 'Welcome to TG Hub Alerts',
    summary: 'Pick the games and categories you care about in Alert preferences. Patch notes for games you favourite land here automatically.',
    url: '/alerts/preferences',
    gameId: null,
    sourceName: 'TG Hub',
    dedupKey: 'seed:welcome',
  });

  /* Marketplace: photos go through the real upload pipeline, listings through the real service. */
  const DAY_MS = 86_400_000;
  const listingIds: string[] = [];
  for (const seedListing of LISTINGS) {
    const sellerId = String(players[seedListing.seller]!._id);
    const photoIds: string[] = [];
    for (let variant = 0; variant < seedListing.art.photos; variant += 1) {
      const svg = listingArt(seedListing.art.kind, seedListing.art.palette, variant);
      const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
      photoIds.push((await storeImage(sellerId, 'listing', jpeg)).id);
    }
    const listing = await createListing(sellerId, listingInputSchema.parse({ ...seedListing.input, photoIds }));
    const listedAt = new Date(Date.now() - seedListing.daysAgo * DAY_MS - Math.floor(Math.random() * 8) * 3_600_000);
    // Raw driver update: Mongoose treats createdAt as immutable, but the demo needs history.
    await Listing.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(listing.id) },
      {
        $set: {
          status: seedListing.status ?? 'active',
          soldAt: seedListing.status === 'sold' ? new Date() : null,
          views: seedListing.views,
          bumpedAt: listedAt,
          createdAt: listedAt,
        },
      },
    );
    listingIds.push(listing.id);
  }
  for (const thread of CONVERSATIONS) {
    const buyerId = String(players[thread.buyer]!._id);
    const sellerId = String(players[LISTINGS[thread.listing]!.seller]!._id);
    const [[, first], ...rest] = thread.messages as [[boolean, string], ...Array<[boolean, string]>];
    const { conversationId } = await messageSeller(buyerId, listingIds[thread.listing]!, first);
    for (const [fromBuyer, body] of rest) await sendMessage(fromBuyer ? buyerId : sellerId, conversationId, body);
  }
  // Three reports flag the ped pack so the moderation queue has something in it.
  for (const reporter of [0, 3, 5]) {
    await reportListing(String(players[reporter]!._id), listingIds[6]!, { reason: 'leaked', details: 'Looks like the same pack that leaked on a forum last month.' });
  }
  await bus.drain();
  logger.info({ listings: LISTINGS.length, conversations: CONVERSATIONS.length }, 'Marketplace seeded');

  /* Social: demo players follow the ones near them in the standings, the admin follows the top. */
  for (const [index, player] of players.entries()) {
    for (const offset of [1, 2, 5]) {
      const other = players[(index + offset) % players.length]!;
      await follow(String(player._id), other.username);
    }
  }
  for (const player of players.slice(0, 6)) await follow(String(admin._id), player.username);
  await bus.drain();

  /* Squads: clans and teammate posts from the demo players. */
  await seedSquads(new Map(players.map((player) => [player.username, String(player._id)])), new Map([...gameIds].map(([slug, gameId]) => [slug, String(gameId)])));
  await bus.drain();

  /* Tournaments: consumed from start.gg / FACEIT. Samples go through the same upsert + announce path. */
  const matchGame = await loadGameMatcher();
  const sampleIds = new Map<string, string>();
  for (const sample of SAMPLE_TOURNAMENTS) {
    const { doc, created } = await upsertTournament('sample', sample.tournament, { matchGame, gameId: gameIds.get(sample.game) ?? null });
    sampleIds.set(sample.tournament.externalId, String(doc._id));
    if (created) await announceTournament(doc);
  }
  // A couple of follows so reminders and the "Following" strip have something to show.
  const follows: Array<[number, string]> = [
    [0, 'sample-sfax-efootball-cup'],
    [0, 'sample-tunis-tekken-monthly-14'],
    [3, 'sample-sfax-efootball-cup'],
  ];
  await TournamentFollow.insertMany(
    follows.map(([playerIndex, externalId]) => ({ userId: players[playerIndex]!._id, tournamentId: sampleIds.get(externalId) })),
  );

  const tournamentSources = [];
  if (startggProvider.configured()) {
    // Resolve start.gg's videogame ids live instead of hard-coding them.
    for (const [slug, title] of [['tekken-8', 'TEKKEN 8'], ['valorant', 'VALORANT'], ['ea-sports-fc-25', 'EA SPORTS FC 25']] as const) {
      const match = (await startggProvider.lookupVideogames(title)).find((g) => g.displayName.toLowerCase() === title.toLowerCase());
      if (!match) continue;
      tournamentSources.push(
        await TournamentSource.create({
          name: `${title} — Tunisia (start.gg)`,
          provider: 'startgg',
          config: { videogameId: match.id, countryCode: 'TN' },
          gameId: gameIds.get(slug),
          intervalMinutes: 180,
        }),
      );
    }
  }
  if (faceitProvider.configured()) {
    tournamentSources.push(
      await TournamentSource.create({
        name: 'CS2 championships — EU (FACEIT)',
        provider: 'faceit',
        config: { game: 'cs2', region: 'EU' },
        gameId: gameIds.get('counter-strike-2'),
        intervalMinutes: 180,
      }),
    );
  }

  /* Alert sources: official Steam announcements */
  const sources = await AlertSource.insertMany(
    STEAM_SOURCES.map((slug) => {
      const game = games.find((g) => g.slug === slug)!;
      return {
        name: `${game.title} — Steam announcements`,
        adapter: 'steam_news',
        config: { appId: game.steamAppId! },
        gameId: game._id,
        category: 'game_update',
        intervalMinutes: 60,
      };
    }),
  );

  if (FETCH_FEEDS && tournamentSources.length > 0) {
    for (const source of tournamentSources) await runTournamentSource(String(source._id));
  }
  logger.info(
    { samples: SAMPLE_TOURNAMENTS.length, liveSources: tournamentSources.length },
    tournamentSources.length > 0 ? 'Tournaments seeded' : 'Tournaments seeded with samples only — set START_GG_TOKEN / FACEIT_API_KEY to mirror real ones',
  );
  await sendTournamentReminders();

  if (FETCH_FEEDS) {
    logger.info('Fetching live Steam announcements (set SEED_FETCH_FEEDS=false to skip)…');
    const results = await Promise.all(sources.map((source) => runSource(String(source._id))));
    const ingested = results.reduce((sum, r) => sum + r.newResources, 0);
    const failed = results.filter((r) => r.source.health === 'failing').map((r) => r.source.name);
    logger.info({ ingested, failed }, 'Steam sources fetched');
  }
  await bus.drain();

  logger.info(`Seed complete. Admin sign-in: ${DEV_ADMIN.username} — password from SEED_ADMIN_PASSWORD or the default in src/seed/index.ts`);
  await disconnectMongo();
}

seed().catch(async (error) => {
  logger.fatal({ err: error }, 'Seed failed');
  await disconnectMongo().catch(() => undefined);
  process.exit(1);
});
