import type { CountryCode, MissionCadence, ResourceKind, TnRegion, TrackableEvent } from '@tgh/shared';

const DAY = 86_400_000;
const now = Date.now();
const inDays = (days: number, hour = 20) => {
  const date = new Date(now + days * DAY);
  date.setUTCHours(hour - 1, 0, 0, 0); // hour is Tunis local (UTC+1)
  return date;
};

/* ───────────── Season 1 ───────────── */

export const SEASON = {
  key: 'season-1',
  title: 'Season 1 · Carthage Rising',
  description: 'Every XP point anyone earns feeds one shared meter. Hit the milestones together, unlock rewards for everyone.',
  goal: 100_000,
  startsAt: new Date('2026-10-01T00:00:00+01:00'),
  endsAt: new Date('2026-12-31T23:59:59+01:00'),
  milestones: [
    { threshold: 25_000, label: '25%', reward: 'Season banner: Medina' },
    { threshold: 50_000, label: '50%', reward: 'Profile frame: Sidi Bou Said' },
    { threshold: 75_000, label: '75%', reward: 'Community LAN night' },
    { threshold: 100_000, label: '100%', reward: 'Title for everyone: Founder' },
  ],
};

/* ───────────── Missions ───────────── */

export interface MissionSeed {
  code: string;
  title: string;
  description: string;
  cadence: MissionCadence;
  event: TrackableEvent;
  target: number;
  xpReward: number;
  order: number;
  startsAt?: Date;
  endsAt?: Date;
}

export const MISSIONS: MissionSeed[] = [
  { code: 'daily-check-in', title: 'Check in', description: 'Open TG Hub today.', cadence: 'daily', event: 'user.daily_login', target: 1, xpReward: 20, order: 1 },
  { code: 'daily-scout', title: 'Scout the Radar', description: 'Run 2 different Radar searches.', cadence: 'daily', event: 'radar.searched', target: 2, xpReward: 30, order: 2 },
  { code: 'daily-browse', title: 'Window shopping', description: 'Open 3 different game pages.', cadence: 'daily', event: 'game.viewed', target: 3, xpReward: 30, order: 3 },
  { code: 'weekly-rig-check', title: 'Will it run?', description: 'Check your rig against 3 different games.', cadence: 'weekly', event: 'pc.compat_checked', target: 3, xpReward: 120, order: 4 },
  { code: 'weekly-curator', title: 'Curator', description: 'Add 3 games to your favourites.', cadence: 'weekly', event: 'game.favorited', target: 3, xpReward: 100, order: 5 },
  { code: 'weekly-regular', title: 'Regular', description: 'Check in on 5 different days this week.', cadence: 'weekly', event: 'user.daily_login', target: 5, xpReward: 200, order: 6 },
  { code: 'weekly-bracket-watcher', title: 'Bracket watcher', description: 'Follow 2 tournaments to get their reminders.', cadence: 'weekly', event: 'tournament.followed', target: 2, xpReward: 80, order: 7 },
  {
    code: 's1-build-your-rig',
    title: 'Carthage Rising: build your rig',
    description: 'Save your PC in the PC Lab during Season 1.',
    cadence: 'special',
    event: 'pc.spec_saved',
    target: 1,
    xpReward: 150,
    order: 8,
    startsAt: SEASON.startsAt,
    endsAt: SEASON.endsAt,
  },
];

/* ───────────── Achievements ───────────── */

export const ACHIEVEMENTS = [
  { code: 'first-boot', title: 'First Boot', description: 'Create your TG Hub account.', criteria: { kind: 'event_count', event: 'user.registered', count: 1 }, xpReward: 50, cosmetic: { kind: 'badge', value: 'first-boot' }, order: 1 },
  { code: 'benchmarked', title: 'Benchmarked', description: 'Save your first rig in the PC Lab.', criteria: { kind: 'event_count', event: 'pc.spec_saved', count: 1 }, xpReward: 75, cosmetic: { kind: 'title', value: 'Tuner' }, order: 2 },
  { code: 'spec-sheriff', title: 'Spec Sheriff', description: 'Check 10 different games against your rig.', criteria: { kind: 'event_count', event: 'pc.compat_checked', count: 10 }, xpReward: 150, cosmetic: { kind: 'title', value: 'Spec Sheriff' }, order: 3 },
  { code: 'collector', title: 'Collector', description: 'Favourite 5 games.', criteria: { kind: 'event_count', event: 'game.favorited', count: 5 }, xpReward: 100, cosmetic: { kind: 'title', value: 'Collector' }, order: 4 },
  { code: 'radar-operator', title: 'Radar Operator', description: 'Run 25 different Radar searches.', criteria: { kind: 'event_count', event: 'radar.searched', count: 25 }, xpReward: 150, cosmetic: { kind: 'title', value: 'Radar Operator' }, order: 5 },
  { code: 'explorer', title: 'Explorer', description: 'Open 15 game pages (one count per game per day).', criteria: { kind: 'event_count', event: 'game.viewed', count: 15 }, xpReward: 120, cosmetic: null, order: 6 },
  { code: 'loyal', title: 'Loyal', description: 'Check in on 7 different days.', criteria: { kind: 'event_count', event: 'user.daily_login', count: 7 }, xpReward: 200, cosmetic: { kind: 'title', value: 'Regular' }, order: 7 },
  { code: 'on-the-bracket', title: 'On the Bracket', description: 'Follow 5 tournaments.', criteria: { kind: 'event_count', event: 'tournament.followed', count: 5 }, xpReward: 120, cosmetic: { kind: 'title', value: 'Bracket Watcher' }, order: 8 },
  { code: 'double-digits', title: 'Double Digits', description: 'Reach level 10.', criteria: { kind: 'level', level: 10 }, xpReward: 250, cosmetic: { kind: 'badge', value: 'level-10' }, order: 9 },
] as const;

/* ───────────── Radar content ───────────── */

export interface ResourceSeed {
  kind: ResourceKind;
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  game?: string;
  tags?: string[];
  publishedAt: Date;
  startsAt?: Date;
  expiresAt?: Date;
  location?: string;
  deal?: { store: string; price: number; originalPrice: number | null; currency: string };
}

/**
 * Demo content so every Radar surface has something to show. Guides and events
 * are TG Hub-style editorial placeholders; deals are clearly labelled samples.
 * Real news and patch notes arrive from the Steam sources below.
 */
export const RESOURCES: ResourceSeed[] = [
  { kind: 'news', title: 'Season 1 · Carthage Rising is live', summary: 'Missions, achievements and the community Pulse are open. Every XP point you earn moves the meter for everyone.', url: '/universe', sourceName: 'TG Hub', tags: ['season', 'universe'], publishedAt: new Date(now - 2 * DAY) },
  { kind: 'news', title: 'PC Lab: check whether your rig runs it', summary: 'Pick your CPU, GPU and RAM once, then compare against any game’s published requirements — with upgrade pointers when you fall short.', url: '/pc', sourceName: 'TG Hub', tags: ['pc-lab'], publishedAt: new Date(now - 4 * DAY) },
  { kind: 'guide', title: 'VALORANT: dialing in sensitivity and crosshair', summary: 'eDPI ranges by role, a clean static crosshair, and how to test changes in the Range before ranked.', url: 'https://playvalorant.com/', sourceName: 'TG Hub Guides', game: 'valorant', tags: ['settings', 'aim'], publishedAt: new Date(now - 6 * DAY) },
  { kind: 'guide', title: 'CS2 on mid-range PCs: video settings that matter', summary: 'Which options cost FPS, which ones help visibility, and why boost-player-contrast stays on.', url: 'https://www.counter-strike.net/', sourceName: 'TG Hub Guides', game: 'counter-strike-2', tags: ['settings', 'performance'], publishedAt: new Date(now - 8 * DAY) },
  { kind: 'guide', title: 'eFootball: building your first Dream Team', summary: 'Spend GP before coins, pick a formation your players fit, and use events for free epics.', url: 'https://www.konami.com/efootball/', sourceName: 'TG Hub Guides', game: 'efootball', tags: ['beginner'], publishedAt: new Date(now - 9 * DAY) },
  { kind: 'guide', title: 'Lower ping from Tunisia: choosing servers and routes', summary: 'Why Frankfurt and Paris usually win, what a wired connection changes, and how to read in-game network graphs.', url: '/pc', sourceName: 'TG Hub Guides', tags: ['network', 'ping'], publishedAt: new Date(now - 11 * DAY) },
  { kind: 'guide', title: 'League of Legends: lane fundamentals for new players', summary: 'Last-hitting, wave states and when to recall — the basics that win more games than mechanics.', url: 'https://www.leagueoflegends.com/', sourceName: 'TG Hub Guides', game: 'league-of-legends', tags: ['beginner'], publishedAt: new Date(now - 13 * DAY) },
  { kind: 'guide', title: 'Fortnite performance mode on low-end laptops', summary: 'Switch the renderer, cap your frame rate, and stop Windows from starving the game of CPU time.', url: 'https://www.fortnite.com/', sourceName: 'TG Hub Guides', game: 'fortnite', tags: ['performance', 'laptop'], publishedAt: new Date(now - 15 * DAY) },
  { kind: 'deal', title: 'ELDEN RING — sample discount', summary: 'Sample deal used for development. Replace with live store data before launch.', url: 'https://store.steampowered.com/app/1245620/', sourceName: 'Sample data', game: 'elden-ring', tags: ['sample'], publishedAt: new Date(now - DAY), expiresAt: inDays(2, 19), deal: { store: 'Steam', price: 23.99, originalPrice: 59.99, currency: 'USD' } },
  { kind: 'deal', title: 'Cyberpunk 2077 — sample discount', summary: 'Sample deal used for development. Replace with live store data before launch.', url: 'https://store.steampowered.com/app/1091500/', sourceName: 'Sample data', game: 'cyberpunk-2077', tags: ['sample'], publishedAt: new Date(now - 2 * DAY), expiresAt: inDays(5, 19), deal: { store: 'Steam', price: 19.79, originalPrice: 59.99, currency: 'USD' } },
  { kind: 'deal', title: 'TEKKEN 8 — sample discount', summary: 'Sample deal used for development. Replace with live store data before launch.', url: 'https://store.steampowered.com/app/1778820/', sourceName: 'Sample data', game: 'tekken-8', tags: ['sample'], publishedAt: new Date(now - 3 * DAY), expiresAt: inDays(0.5, 23), deal: { store: 'Steam', price: 27.99, originalPrice: 69.99, currency: 'USD' } },
  { kind: 'deal', title: 'Free weekend — sample giveaway', summary: 'Sample free-to-keep item used to show how giveaways and expiry reminders look.', url: 'https://store.epicgames.com/free-games', sourceName: 'Sample data', tags: ['sample', 'free'], publishedAt: new Date(now - DAY), expiresAt: inDays(6, 17), deal: { store: 'Epic Games Store', price: 0, originalPrice: 19.99, currency: 'USD' } },
  { kind: 'event', title: 'Sousse community LAN meetup', summary: 'Bring your rig or play on site — casual sets, no bracket. Sample event.', url: '/radar?kind=event', sourceName: 'TG Hub Events', game: 'tekken-8', tags: ['lan', 'meetup'], publishedAt: new Date(now - 5 * DAY), startsAt: inDays(21, 14), expiresAt: inDays(21, 22), location: 'Sousse' },
];

/* ───────────── Players ───────────── */

export interface PlayerSeed {
  username: string;
  region: TnRegion | null;
  /** Defaults to TN. */
  country?: CountryCode;
  xp: number;
  bio: string;
}

export const PLAYERS: PlayerSeed[] = [
  { username: 'kaiser.tn', region: 'Tunis', xp: 9_400, bio: 'IGL, coffee, Inferno.' },
  { username: 'sfaxsniper', region: 'Sfax', xp: 7_900, bio: 'AWP only. Sfax represent.' },
  { username: 'medina_mage', region: 'Tunis', xp: 6_300, bio: 'Mid main since season 4.' },
  { username: 'sousse_striker', region: 'Sousse', xp: 5_800, bio: 'eFootball Friday regular.' },
  { username: 'carthage_kid', region: 'Ariana', xp: 4_700, bio: 'Duelist. Will entry.' },
  { username: 'bizerte_breeze', region: 'Bizerte', xp: 3_600, bio: 'Rocket League, mostly aerials.' },
  { username: 'monastir_mvp', region: 'Monastir', xp: 2_900, bio: 'Tekken 8 — Jin player.' },
  { username: 'nabeul_nova', region: 'Nabeul', xp: 2_100, bio: 'Support mains unite.' },
  { username: 'kairouan_king', region: 'Kairouan', xp: 1_600, bio: '' },
  { username: 'gabes_ghost', region: 'Gabès', xp: 1_100, bio: 'Lurker.' },
  { username: 'djerba_drift', region: 'Medenine', xp: 700, bio: 'Island ping is real.' },
  { username: 'ariana_ace', region: 'Ariana', xp: 350, bio: 'New here.' },
  { username: 'lyon_lynx', region: null, country: 'FR', xp: 2_400, bio: 'Tunisian in Lyon. EU ping, TN heart.' },
];
