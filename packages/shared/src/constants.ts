import { COUNTRY_NAMES } from './countries';

export const ROLES = ['user', 'moderator', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['active', 'banned'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const PLATFORMS = ['pc', 'playstation', 'xbox', 'switch', 'mobile'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  pc: 'PC',
  playstation: 'PlayStation',
  xbox: 'Xbox',
  switch: 'Switch',
  mobile: 'Mobile',
};

export const GENRES = [
  'fps',
  'battle-royale',
  'moba',
  'hero-shooter',
  'sports',
  'racing',
  'fighting',
  'rpg',
  'action',
  'sandbox',
  'strategy',
] as const;
export type Genre = (typeof GENRES)[number];

export const GENRE_LABELS: Record<Genre, string> = {
  fps: 'FPS',
  'battle-royale': 'Battle royale',
  moba: 'MOBA',
  'hero-shooter': 'Hero shooter',
  sports: 'Sports',
  racing: 'Racing',
  fighting: 'Fighting',
  rpg: 'RPG',
  action: 'Action',
  sandbox: 'Sandbox',
  strategy: 'Strategy',
};

export const GAME_MODES = ['competitive', 'co-op', 'casual', 'single-player'] as const;
export type GameMode = (typeof GAME_MODES)[number];

export const RESOURCE_KINDS = ['news', 'patch', 'guide', 'deal', 'event'] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const RESOURCE_KIND_LABELS: Record<ResourceKind, string> = {
  news: 'News',
  patch: 'Patch notes',
  guide: 'Guide',
  deal: 'Deal',
  event: 'Event',
};

export const ALERT_CATEGORIES = ['game_update', 'deal', 'tournament', 'social', 'announcement'] as const;
export type AlertCategory = (typeof ALERT_CATEGORIES)[number];

export const ALERT_CATEGORY_META: Record<AlertCategory, { label: string; description: string }> = {
  game_update: {
    label: 'Game updates',
    description: 'Patch notes and official announcements for games you follow.',
  },
  deal: {
    label: 'Free games & deals',
    description: 'Giveaways and discounts, with a reminder before they expire.',
  },
  tournament: {
    label: 'Tournaments',
    description: 'Registrations opening, schedules and match reminders.',
  },
  social: {
    label: 'Your activity',
    description: 'Level-ups, achievements, marketplace messages and saved-search matches, followers, clans and squads.',
  },
  announcement: {
    label: 'TG Hub news',
    description: 'Platform announcements and community Pulse milestones.',
  },
};

/** Who a broadcast alert reaches: everyone with the category on, or only followers of its game. */
export const ALERT_AUDIENCES = ['everyone', 'game_followers'] as const;
export type AlertAudience = (typeof ALERT_AUDIENCES)[number];

export const ALERT_CHANNELS = ['inbox', 'discord', 'push'] as const;
export type AlertChannelName = (typeof ALERT_CHANNELS)[number];

export const SOURCE_ADAPTERS = ['steam_news'] as const;
export type SourceAdapterName = (typeof SOURCE_ADAPTERS)[number];

export const COMPONENT_TYPES = ['cpu', 'gpu'] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];

export const COMPONENT_BRANDS = ['AMD', 'Intel', 'NVIDIA'] as const;
export type ComponentBrand = (typeof COMPONENT_BRANDS)[number];

/** Laptop chips run at lower power than desktop parts with the same name; integrated graphics share system RAM. */
export const COMPONENT_SEGMENTS = ['desktop', 'laptop', 'integrated'] as const;
export type ComponentSegment = (typeof COMPONENT_SEGMENTS)[number];

export const COMPONENT_SEGMENT_LABELS: Record<ComponentSegment, string> = {
  desktop: 'Desktop',
  laptop: 'Laptop',
  integrated: 'Integrated',
};

export const OPERATING_SYSTEMS = ['windows-11', 'windows-10', 'linux', 'macos'] as const;
export type OperatingSystem = (typeof OPERATING_SYSTEMS)[number];

export const OS_LABELS: Record<OperatingSystem, string> = {
  'windows-11': 'Windows 11',
  'windows-10': 'Windows 10',
  linux: 'Linux',
  macos: 'macOS',
};

export const MISSION_CADENCES = ['daily', 'weekly', 'special'] as const;
export type MissionCadence = (typeof MISSION_CADENCES)[number];

/** Server-side events that missions and achievements can count. */
export const TRACKABLE_EVENTS = [
  'user.registered',
  'user.daily_login',
  'game.viewed',
  'game.favorited',
  'pc.spec_saved',
  'pc.compat_checked',
  'radar.searched',
  'tournament.followed',
] as const;
export type TrackableEvent = (typeof TRACKABLE_EVENTS)[number];

/**
 * Tournaments are consumed from the platforms that run them; TG Hub never hosts
 * brackets or registration. "sample" marks development fixtures only.
 */
export const TOURNAMENT_PROVIDERS = ['startgg', 'faceit', 'sample'] as const;
export type TournamentProvider = (typeof TOURNAMENT_PROVIDERS)[number];

export const DISCOVERY_PROVIDERS = ['startgg', 'faceit'] as const;
export type DiscoveryProvider = (typeof DISCOVERY_PROVIDERS)[number];

export const TOURNAMENT_PROVIDER_META: Record<TournamentProvider, { label: string; site: string | null }> = {
  startgg: { label: 'start.gg', site: 'https://www.start.gg' },
  faceit: { label: 'FACEIT', site: 'https://www.faceit.com' },
  sample: { label: 'Sample data', site: null },
};

export const TOURNAMENT_STATUSES = ['registration_open', 'upcoming', 'live', 'completed', 'cancelled'] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export const TOURNAMENT_STATUS_LABELS: Record<TournamentStatus, string> = {
  registration_open: 'Registration open',
  upcoming: 'Upcoming',
  live: 'Live',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/** List views on /tournaments. "open" is the subset of "upcoming" still taking sign-ups. */
export const TOURNAMENT_LISTS = ['open', 'upcoming', 'live', 'completed'] as const;
export type TournamentList = (typeof TOURNAMENT_LISTS)[number];

export const TOURNAMENT_WHERE = ['all', 'tn', 'online'] as const;
export type TournamentWhere = (typeof TOURNAMENT_WHERE)[number];

export const TN_REGIONS = [
  'Tunis',
  'Ariana',
  'Ben Arous',
  'Manouba',
  'Nabeul',
  'Zaghouan',
  'Bizerte',
  'Béja',
  'Jendouba',
  'Le Kef',
  'Siliana',
  'Sousse',
  'Monastir',
  'Mahdia',
  'Sfax',
  'Kairouan',
  'Kasserine',
  'Sidi Bouzid',
  'Gabès',
  'Medenine',
  'Tataouine',
  'Gafsa',
  'Tozeur',
  'Kebili',
  'Abroad',
] as const;
export type TnRegion = (typeof TN_REGIONS)[number];

/** Monogram avatar backgrounds — the profile picture until uploads exist. */
export const AVATAR_COLORS = ['#e10600', '#f2f1ec', '#3a3a42', '#8a1c14', '#c9c6bb', '#1d1d22', '#1a63db'] as const;

export const MAX_PC_SPECS_PER_USER = 5;

/* ───────────── Marketplace ───────────── */

/**
 * Player-to-player listings, Facebook Marketplace style: TG Hub hosts the
 * listing and the conversation; payment and hand-over happen between players.
 * Prices are whole Tunisian dinars so every listing sorts on one scale.
 */
export const MARKET_CATEGORIES = ['fivem', 'mods', 'gaming-pcs', 'pc-parts', 'consoles', 'peripherals', 'setup', 'games', 'other'] as const;
export type MarketCategory = (typeof MARKET_CATEGORIES)[number];

export const MARKET_CATEGORY_META: Record<MarketCategory, { label: string; description: string; digital: boolean }> = {
  fivem: { label: 'FiveM & RP assets', description: 'Scripts, MLOs, vehicles, EUP, server bases', digital: true },
  mods: { label: 'Mods & game assets', description: 'Minecraft, Roblox, SA-MP and other mods', digital: true },
  'gaming-pcs': { label: 'Gaming PCs & laptops', description: 'Complete builds and gaming laptops', digital: false },
  'pc-parts': { label: 'PC parts', description: 'GPUs, CPUs, RAM, storage, PSUs', digital: false },
  consoles: { label: 'Consoles', description: 'PlayStation, Xbox, Nintendo, handhelds', digital: false },
  peripherals: { label: 'Peripherals', description: 'Keyboards, mice, headsets, controllers', digital: false },
  setup: { label: 'Monitors & setup', description: 'Monitors, chairs, desks, streaming gear', digital: false },
  games: { label: 'Games & collectibles', description: 'Physical games, editions, merch', digital: false },
  other: { label: 'Other', description: 'Anything else gaming', digital: false },
};

export const MARKET_SUBCATEGORIES = {
  fivem: ['scripts', 'mlo', 'vehicles', 'clothing', 'peds', 'ui', 'server-base', 'services'],
  mods: ['minecraft', 'roblox', 'samp', 'gta-v', 'other-mods'],
  'gaming-pcs': ['desktop', 'laptop'],
  'pc-parts': ['gpu', 'cpu', 'motherboard', 'ram', 'storage', 'psu', 'case', 'cooling'],
  consoles: ['playstation', 'xbox', 'nintendo', 'handheld', 'vr'],
  peripherals: ['keyboard', 'mouse', 'headset', 'controller', 'mic-cam'],
  setup: ['monitor', 'chair', 'desk', 'streaming', 'network'],
  games: ['ps-games', 'xbox-games', 'switch-games', 'pc-games', 'collectibles'],
  other: [],
} as const satisfies Record<MarketCategory, readonly string[]>;
export type MarketSubcategory = (typeof MARKET_SUBCATEGORIES)[MarketCategory][number];

export const MARKET_SUBCATEGORY_LABELS: Record<MarketSubcategory, string> = {
  scripts: 'Scripts',
  mlo: 'MLOs & maps',
  vehicles: 'Vehicles',
  clothing: 'Clothing & EUP',
  peds: 'Peds',
  ui: 'UI & HUDs',
  'server-base': 'Server bases',
  services: 'Dev services',
  minecraft: 'Minecraft',
  roblox: 'Roblox',
  samp: 'SA-MP / open.mp',
  'gta-v': 'GTA V single-player',
  'other-mods': 'Other games',
  desktop: 'Desktops',
  laptop: 'Laptops',
  gpu: 'Graphics cards',
  cpu: 'Processors',
  motherboard: 'Motherboards',
  ram: 'Memory',
  storage: 'Storage',
  psu: 'Power supplies',
  case: 'Cases',
  cooling: 'Cooling',
  playstation: 'PlayStation',
  xbox: 'Xbox',
  nintendo: 'Nintendo',
  handheld: 'Handheld PCs',
  vr: 'VR headsets',
  keyboard: 'Keyboards',
  mouse: 'Mice',
  headset: 'Headsets',
  controller: 'Controllers',
  'mic-cam': 'Mics & cameras',
  monitor: 'Monitors',
  chair: 'Chairs',
  desk: 'Desks',
  streaming: 'Streaming gear',
  network: 'Networking',
  'ps-games': 'PlayStation games',
  'xbox-games': 'Xbox games',
  'switch-games': 'Switch games',
  'pc-games': 'PC games',
  collectibles: 'Collectibles',
};

export function isDigitalCategory(category: MarketCategory): boolean {
  return MARKET_CATEGORY_META[category].digital;
}

export function isSubcategoryOf(category: MarketCategory, subcategory: string): subcategory is MarketSubcategory {
  return (MARKET_SUBCATEGORIES[category] as readonly string[]).includes(subcategory);
}

/** FiveM resources are built for a framework; buyers filter on it before anything else. */
export const FIVEM_FRAMEWORKS = ['standalone', 'esx', 'qbcore', 'qbox', 'ox', 'vrp'] as const;
export type FivemFramework = (typeof FIVEM_FRAMEWORKS)[number];

export const FIVEM_FRAMEWORK_LABELS: Record<FivemFramework, string> = {
  standalone: 'Standalone',
  esx: 'ESX',
  qbcore: 'QBCore',
  qbox: 'Qbox',
  ox: 'ox_core',
  vrp: 'vRP',
};

/** How a digital asset reaches the buyer. Keymaster = Cfx.re asset transfer. */
export const ASSET_DELIVERIES = ['keymaster', 'tebex', 'download', 'other'] as const;
export type AssetDelivery = (typeof ASSET_DELIVERIES)[number];

export const ASSET_DELIVERY_LABELS: Record<AssetDelivery, string> = {
  keymaster: 'Cfx Keymaster transfer',
  tebex: 'Tebex',
  download: 'Direct download',
  other: 'Arranged with seller',
};

export const ASSET_SOURCES = ['open', 'escrow'] as const;
export type AssetSource = (typeof ASSET_SOURCES)[number];

export const ASSET_SOURCE_LABELS: Record<AssetSource, string> = {
  open: 'Open source',
  escrow: 'Escrowed (Cfx)',
};

export const MARKET_CONDITIONS = ['new', 'like-new', 'good', 'fair', 'for-parts'] as const;
export type MarketCondition = (typeof MARKET_CONDITIONS)[number];

export const MARKET_CONDITION_LABELS: Record<MarketCondition, string> = {
  new: 'New',
  'like-new': 'Used – like new',
  good: 'Used – good',
  fair: 'Used – fair',
  'for-parts': 'For parts',
};

/** "removed" is a moderator decision, "deleted" the seller's; neither is ever listed publicly. */
export const LISTING_STATUSES = ['active', 'pending', 'sold', 'removed', 'deleted'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

/** What a seller may set on their own listing. */
export const SELLER_LISTING_STATUSES = ['active', 'pending', 'sold'] as const;
export type SellerListingStatus = (typeof SELLER_LISTING_STATUSES)[number];

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  active: 'Active',
  pending: 'Pending',
  sold: 'Sold',
  removed: 'Removed',
  deleted: 'Deleted',
};

export const MARKET_SORTS = ['newest', 'price-asc', 'price-desc'] as const;
export type MarketSort = (typeof MARKET_SORTS)[number];

export const MARKET_REPORT_REASONS = ['scam', 'leaked', 'prohibited', 'wrong-category', 'offensive', 'other'] as const;
export type MarketReportReason = (typeof MARKET_REPORT_REASONS)[number];

export const MARKET_REPORT_REASON_LABELS: Record<MarketReportReason, string> = {
  scam: 'Looks like a scam',
  leaked: 'Leaked or stolen asset',
  prohibited: 'Prohibited item',
  'wrong-category': 'Wrong category',
  offensive: 'Offensive content',
  other: 'Something else',
};

export const MAX_LISTING_PHOTOS = 10;
export const MAX_LISTING_PRICE_TND = 500_000;
/** Distinct reports that push a listing into the moderation queue. */
export const MARKET_REPORT_FLAG_THRESHOLD = 3;
/** Verified seller badge: earned automatically when all of these hold. */
export const SELLER_BADGE_RULES = { minSales: 3, minRatings: 3, minAverage: 4, minAccountDays: 30, cleanDays: 90 } as const;
export const MAX_SAVED_SEARCHES = 20;

/** Paid boosts: a "Featured" badge and a spot in the featured row at the top of the marketplace. */
export const FEATURE_PLANS = {
  '3d': { days: 3, priceTnd: 5, label: '3 days' },
  '7d': { days: 7, priceTnd: 9, label: '1 week' },
  '14d': { days: 14, priceTnd: 15, label: '2 weeks' },
} as const;
export type FeaturePlan = keyof typeof FEATURE_PLANS;
export const FEATURE_PLAN_IDS = Object.keys(FEATURE_PLANS) as FeaturePlan[];

export const PAYMENT_PROVIDERS = ['flouci', 'konnect', 'dev'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const ORDER_STATUSES = ['pending', 'paid', 'failed', 'expired'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Buyers can change their rating for this long after leaving it. */
export const RATING_EDIT_DAYS = 14;

/** A seller can bump a listing back to the top of "Newest" once per day. */
export const MARKET_RENEW_COOLDOWN_HOURS = 24;

/* ───────────── Countries ───────────── */

/** ISO 3166-1 alpha-2. Players can be anywhere; Tunisians also pick a governorate. */
export const COUNTRY_CODES = Object.keys(COUNTRY_NAMES) as Array<keyof typeof COUNTRY_NAMES>;
export type CountryCode = keyof typeof COUNTRY_NAMES;

/** Shown first in pickers: home, the region, and where most of the diaspora lives. */
export const SUGGESTED_COUNTRIES: CountryCode[] = ['TN', 'DZ', 'LY', 'MA', 'EG', 'FR', 'DE', 'IT', 'BE', 'CA', 'SA', 'AE', 'QA'];

/** Governorates a Tunisian player can pick ("Abroad" is only for marketplace locations). */
export const TN_GOVERNORATES = TN_REGIONS.filter((region) => region !== 'Abroad') as Array<Exclude<TnRegion, 'Abroad'>>;
export type TnGovernorate = (typeof TN_GOVERNORATES)[number];

export function countryName(code: string): string {
  return COUNTRY_NAMES[code as CountryCode] ?? code;
}

/** "Sfax, Tunisia" · "France" · null. */
export function homeLabel(place: { country: string | null; region: string | null }): string | null {
  if (place.country === 'TN') return place.region ? `${place.region}, Tunisia` : 'Tunisia';
  if (place.country) return countryName(place.country);
  return place.region && place.region !== 'Abroad' ? place.region : null;
}

/* ───────────── Squads: clans and teammate finder ───────────── */

export const CLAN_ROLES = ['owner', 'officer', 'member'] as const;
export type ClanRole = (typeof CLAN_ROLES)[number];

export const CLAN_ROLE_LABELS: Record<ClanRole, string> = { owner: 'Leader', officer: 'Officer', member: 'Member' };

export const CLAN_JOIN_POLICIES = ['open', 'request', 'closed'] as const;
export type ClanJoinPolicy = (typeof CLAN_JOIN_POLICIES)[number];

export const CLAN_JOIN_POLICY_META: Record<ClanJoinPolicy, { label: string; description: string }> = {
  open: { label: 'Open', description: 'Anyone can join straight away' },
  request: { label: 'Apply to join', description: 'Players apply; leaders and officers decide' },
  closed: { label: 'Not recruiting', description: 'Nobody can join or apply for now' },
};

/** Emblem backgrounds. White text sits on every one of them. */
export const CLAN_COLORS = ['#e10600', '#0a96e8', '#d18a00', '#1f9d55', '#7c4dff', '#1d1d22', '#0f8b8d', '#c2410c'] as const;

export const MAX_CLAN_MEMBERS = 50;
export const MAX_CLAN_GAMES = 3;

export const LFG_LANGUAGES = ['ar', 'fr', 'en'] as const;
export type LfgLanguage = (typeof LFG_LANGUAGES)[number];
export const LFG_LANGUAGE_LABELS: Record<LfgLanguage, string> = { ar: 'Derja / Arabic', fr: 'French', en: 'English' };

/** How long a teammate post stays up. */
export const LFG_DURATIONS_HOURS = [2, 6, 24, 72] as const;
export const LFG_MAX_SLOTS = 9;
/** Open posts one player can have at once. */
export const LFG_MAX_OPEN_POSTS = 3;

/* ───────────── Social ───────────── */

export const ACTIVITY_TYPES = ['level_up', 'achievement', 'listing', 'clan_founded', 'clan_joined', 'lfg_posted', 'game_favorited'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Following cap per player — generous, but stops follow-bots. */
export const MAX_FOLLOWING = 2_000;
