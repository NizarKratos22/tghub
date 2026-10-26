/**
 * Response contracts. Every client (web, Android, Discord bot) reads these
 * shapes; the API maps database documents into them in one place per module.
 * Dates travel as ISO strings.
 */
import type {
  AlertCategory,
  AlertChannelName,
  AssetDelivery,
  AssetSource,
  ActivityType,
  ClanJoinPolicy,
  ClanRole,
  ComponentBrand,
  ComponentSegment,
  ComponentType,
  CountryCode,
  FivemFramework,
  GameMode,
  Genre,
  LfgLanguage,
  FeaturePlan,
  ListingStatus,
  OrderStatus,
  PaymentProvider,
  MarketCategory,
  MarketCondition,
  MarketReportReason,
  MarketSubcategory,
  MissionCadence,
  OperatingSystem,
  Platform,
  ResourceKind,
  Role,
  SourceAdapterName,
  TnRegion,
  TournamentProvider,
  TournamentStatus,
  TrackableEvent,
  UserStatus,
} from './constants';
import type { SearchCriteria } from './schemas/market';

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

/* ───────────── Users & auth ───────────── */

export interface UserPublic {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  /** Uploaded profile picture; null shows the monogram. */
  avatarUrl: string | null;
  /** Wide image across the top of the public profile. */
  bannerUrl: string | null;
  bio: string;
  country: CountryCode | null;
  /** Governorate, for players in Tunisia. */
  region: TnRegion | null;
  level: number;
  xp: number;
  title: string;
  createdAt: string;
}

export interface Me extends UserPublic {
  email: string;
  /** New accounts confirm their address with a 6-digit code before using the marketplace. */
  emailVerified: boolean;
  role: Role;
  unreadCount: number;
  /** Marketplace conversations with messages the player hasn't read. */
  marketUnread: number;
  availableTitles: string[];
  shareActivity: boolean;
}

export interface CountryStanding {
  country: CountryCode;
  xp: number;
  players: number;
}

/** A signed-in device, for the "where you're signed in" list. */
export interface SessionInfo {
  id: string;
  device: string;
  ip: string;
  lastUsedAt: string;
  createdAt: string;
  current: boolean;
}

export interface EmailVerificationStatus {
  /** Masked, e.g. "kr•••••@gmail.com". */
  email: string;
  expiresAt: string;
  /** When another code may be requested. */
  resendAt: string;
  /** Development without SMTP only: the code itself, so local sign-ups can finish. */
  devCode?: string;
}

export interface AuthResult {
  user: Me;
  /** Present right after sign-up: where the code went and when it expires. */
  verification?: EmailVerificationStatus;
  accessToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  /** Only returned to native clients (X-Client-Type: native). */
  refreshToken?: string;
}

export interface PublicProfile {
  user: UserPublic;
  reputation: SellerReputation;
  clan: ClanBadge | null;
  followers: number;
  following: number;
  steam: { profileUrl: string; personaName: string | null } | null;
  discordLinked: boolean;
  seasonRank: number | null;
  seasonXp: number;
  achievements: Array<{ code: string; title: string; unlockedAt: string }>;
  favoriteGames: GameSummary[];
}

/* ───────────── Games & Radar ───────────── */

export interface GameRef {
  id: string;
  slug: string;
  title: string;
  monogram: string;
  accent: string;
}

export interface RequirementTier {
  cpuLabel: string;
  gpuLabel: string;
  cpuScore: number | null;
  gpuScore: number | null;
  ramGb: number;
  vramGb: number | null;
  storageGb: number | null;
  os: string | null;
}

export interface GameSummary extends GameRef {
  tagline: string;
  genres: Genre[];
  platforms: Platform[];
  freeToPlay: boolean;
  coverUrl: string | null;
  developer: string;
  releaseYear: number | null;
  popularity: number;
  hasPcRequirements: boolean;
}

export interface GameDetail extends GameSummary {
  description: string;
  publisher: string;
  modes: GameMode[];
  languages: string[];
  links: { official: string | null; store: string | null };
  /** Wide key art for the page header (IGDB artwork, else a screenshot). */
  artworkUrl: string | null;
  screenshots: Array<{ thumbUrl: string; url: string }>;
  /** YouTube ids of trailers and gameplay videos. */
  videos: string[];
  /** IGDB's combined critic + player rating, 0–100. */
  rating: { score: number; count: number } | null;
  /** The game's IGDB page, for attribution. Null when the game isn't linked to IGDB. */
  igdbUrl: string | null;
  requirements: {
    minimum: RequirementTier | null;
    recommended: RequirementTier | null;
    source: string | null;
  };
}

export interface Resource {
  id: string;
  kind: ResourceKind;
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  game: GameRef | null;
  tags: string[];
  publishedAt: string;
  startsAt: string | null;
  expiresAt: string | null;
  location: string | null;
  deal: {
    store: string;
    price: number;
    originalPrice: number | null;
    currency: string;
    discountPct: number | null;
  } | null;
  /**
   * Card picture: the source's own (Steam's header for the post), else one of
   * the game's IGDB screenshots. `wideUrl` is the large size for a hero slot.
   */
  image: { url: string; wideUrl: string; fromGame: boolean } | null;
  isExpired: boolean;
}

/** Radar tab counts for the current search and game. Deals and events count only those still running. */
export type RadarKindCounts = Record<ResourceKind | 'all', number>;

export interface RadarSearchResult {
  query: string;
  games: GameSummary[];
  resources: Resource[];
  tournaments: TournamentSummary[];
}

export interface HomeFeed {
  featured: GameSummary[];
  latest: Resource[];
  deals: Resource[];
  tournaments: TournamentSummary[];
  pulse: Pulse | null;
  leaders: LeaderboardEntry[];
  ticker: Resource[];
  listings: ListingCard[];
}

/* ───────────── Tournaments (consumed from external platforms) ───────────── */

export interface TournamentSummary {
  id: string;
  slug: string;
  name: string;
  provider: TournamentProvider;
  /** The organizer's page — registration always happens there. Null for samples. */
  url: string | null;
  game: GameRef | null;
  /** Game name as the provider spells it, when it isn't in our catalogue. */
  gameName: string | null;
  imageUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  status: TournamentStatus;
  online: boolean | null;
  location: { city: string | null; countryCode: string | null; venue: string | null } | null;
  /** Takes place in Tunisia. */
  isLocal: boolean;
  region: string | null;
  teamSize: number | null;
  format: string | null;
  participants: { count: number | null; cap: number | null };
  registration: { isOpen: boolean | null; closesAt: string | null };
  prize: string | null;
  featured: boolean;
}

export interface TournamentStanding {
  placement: number;
  name: string;
}

export interface TournamentDetail extends TournamentSummary {
  description: string;
  organizer: { name: string; url: string | null } | null;
  events: Array<{
    name: string;
    gameName: string | null;
    startsAt: string | null;
    entrants: number | null;
    teamSize: number | null;
    standings: TournamentStanding[];
  }>;
  followers: number;
  lastSyncedAt: string | null;
}

export interface AdminTournament extends TournamentSummary {
  hidden: boolean;
  sourceName: string | null;
  lastSyncedAt: string | null;
}

export interface TournamentProviderInfo {
  provider: DiscoveryProviderName;
  label: string;
  /** Whether the API credential is set on the server. */
  configured: boolean;
  credentialEnv: string;
}

type DiscoveryProviderName = Exclude<TournamentProvider, 'sample'>;

export interface TournamentSource {
  id: string;
  name: string;
  provider: DiscoveryProviderName;
  config: Record<string, unknown>;
  game: GameRef | null;
  enabled: boolean;
  intervalMinutes: number;
  health: 'healthy' | 'failing' | 'disabled' | 'pending';
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  itemsIngested: number;
}

export interface TournamentSourceRunResult {
  source: TournamentSource;
  fetched: number;
  created: number;
  updated: number;
}

export interface TournamentImportResult {
  tournament: TournamentSummary;
  created: boolean;
}

export interface StartggVideogame {
  id: number;
  name: string;
  displayName: string;
}

/* ───────────── PC Lab ───────────── */

export interface HardwareComponent {
  id: string;
  /** Stable reference, e.g. "nvidia-rtx-4060-laptop". */
  key: string;
  type: ComponentType;
  brand: ComponentBrand;
  model: string;
  /** Family for browsing, e.g. "GeForce RTX 40" or "Ryzen laptop". */
  series: string;
  segment: ComponentSegment;
  score: number;
  vramGb: number | null;
  releaseYear: number | null;
  priceTnd: { amount: number; source: string; updatedAt: string } | null;
}

/** A common setup players can start from instead of searching part by part. */
export interface RigPreset {
  id: string;
  name: string;
  description: string;
  cpu: HardwareComponent;
  gpu: HardwareComponent;
  ramGb: number;
}

export interface PcSpec {
  id: string;
  name: string;
  cpu: HardwareComponent;
  gpu: HardwareComponent;
  ramGb: number;
  storageGb: number | null;
  os: OperatingSystem;
  isPrimary: boolean;
  createdAt: string;
}

/** Ordered worst → best. */
export type CheckStatus = 'below' | 'minimum' | 'recommended' | 'unknown';
export type CompatDimensionKey = 'cpu' | 'gpu' | 'ram' | 'vram' | 'storage';

export interface CompatDimension {
  key: CompatDimensionKey;
  label: string;
  have: string;
  minimum: string | null;
  recommended: string | null;
  status: CheckStatus;
  /** have / recommended (or minimum when no recommended tier). 1.2 = 20% above. */
  ratio: number | null;
}

/**
 * The English sentences (headline, detail, notes) serve the bot and other
 * clients; the site words the verdict itself from the structured fields.
 */
export interface CompatResult {
  game: GameSummary;
  overall: CheckStatus;
  confidence: 'full' | 'partial' | 'none';
  headline: string;
  detail: string;
  dimensions: CompatDimension[];
  bottleneck: CompatDimensionKey | null;
  /** The developer published one tier only, so "recommended" means "meets it". */
  singleTier: boolean;
  upgrades: Array<{ key: 'cpu' | 'gpu'; target: 'minimum' | 'recommended'; options: HardwareComponent[] }>;
  /** Context for the upgrade list, e.g. laptops can't swap CPU/GPU. */
  upgradeNote: string | null;
  upgradeNoteKind: 'laptop' | 'socket' | null;
  ramAdvice: string | null;
  /** RAM that would reach the recommended tier, when the rig has less. */
  ramTargetGb: number | null;
}

export interface CompatibleGames {
  recommended: GameSummary[];
  minimum: GameSummary[];
  below: GameSummary[];
  unknown: GameSummary[];
}

/* ───────────── Universe ───────────── */

export interface ProgressionSnapshot {
  xp: number;
  level: number;
  title: string;
  currentLevelXp: number;
  nextLevelXp: number;
  progress: number;
  seasonKey: string | null;
  seasonXp: number;
  seasonRank: number | null;
}

export interface Mission {
  id: string;
  code: string;
  title: string;
  description: string;
  cadence: MissionCadence;
  /** What counts towards it — the Universe page links each mission to where you do that. */
  event: TrackableEvent;
  target: number;
  progress: number;
  xpReward: number;
  periodKey: string;
  resetsAt: string | null;
  completedAt: string | null;
  claimedAt: string | null;
}

export interface Achievement {
  id: string;
  code: string;
  title: string;
  description: string;
  xpReward: number;
  cosmetic: { kind: 'title' | 'badge'; value: string } | null;
  unlockedAt: string | null;
  /** Share of players who unlocked it, 0..100. */
  rarity: number;
}

export interface PulseMilestone {
  threshold: number;
  label: string;
  reward: string;
  reached: boolean;
}

export interface Pulse {
  key: string;
  title: string;
  description: string;
  goal: number;
  current: number;
  progress: number;
  startsAt: string;
  endsAt: string;
  contributors: number;
  milestones: PulseMilestone[];
}

export interface LeaderboardEntry {
  rank: number;
  xp: number;
  user: Pick<UserPublic, 'id' | 'username' | 'displayName' | 'avatarColor' | 'avatarUrl' | 'level' | 'country' | 'region' | 'title'>;
}

export interface RegionStanding {
  region: TnRegion;
  xp: number;
  players: number;
}

export interface XpEntry {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
}

/* ───────────── Alerts ───────────── */

export interface Notification {
  id: string;
  category: AlertCategory;
  title: string;
  summary: string;
  url: string | null;
  sourceName: string;
  game: GameRef | null;
  publishedAt: string;
  createdAt: string;
  readAt: string | null;
}

export interface AlertPreferences {
  categories: Record<AlertCategory, boolean>;
  followedGameIds: string[];
  followAllGames: boolean;
  maxPerDay: number;
}

export interface AdminAlert {
  id: string;
  category: AlertCategory;
  title: string;
  summary: string;
  url: string | null;
  sourceName: string;
  dedupKey: string;
  game: GameRef | null;
  targeted: boolean;
  publishedAt: string;
  createdAt: string;
}

export interface PublishAlertResult {
  alert: AdminAlert;
  duplicate: boolean;
  deliveries: DeliveryLog[];
}

export interface DeliveryLog {
  id: string;
  alertId: string;
  alertTitle: string;
  channel: AlertChannelName;
  status: 'sent' | 'skipped' | 'failed';
  recipients: number;
  detail: string | null;
  createdAt: string;
}

export interface AlertSource {
  id: string;
  name: string;
  adapter: SourceAdapterName;
  config: { appId: number | null; includeDlc: boolean };
  game: GameRef | null;
  category: AlertCategory;
  enabled: boolean;
  intervalMinutes: number;
  health: 'healthy' | 'failing' | 'disabled' | 'pending';
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  itemsIngested: number;
}

export interface SourceRunResult {
  source: AlertSource;
  fetched: number;
  newResources: number;
  alertsPublished: number;
}

export interface DiscordTarget {
  id: string;
  name: string;
  /** Webhook URLs are secrets — only the tail is ever returned. */
  webhookHint: string;
  categories: AlertCategory[];
  enabled: boolean;
  lastDeliveredAt: string | null;
  lastError: string | null;
}

/* ───────────── Admin ───────────── */

export interface AdminOverview {
  users: number;
  newUsers7d: number;
  games: number;
  resources: number;
  alerts24h: number;
  notifications24h: number;
  failingSources: number;
  xpAwarded7d: number;
  upcomingTournaments: number;
  activeListings: number;
  flaggedListings: number;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  status: UserStatus;
  level: number;
  xp: number;
  country: CountryCode | null;
  region: TnRegion | null;
  displayName: string;
  avatarColor: string;
  avatarUrl: string | null;
  hasBanner: boolean;
  sellerVerified: boolean;
  sellerOverride: 'auto' | 'verified' | 'revoked';
  createdAt: string;
}

export interface AdminMission {
  id: string;
  code: string;
  title: string;
  description: string;
  cadence: MissionCadence;
  event: TrackableEvent;
  target: number;
  xpReward: number;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

/* ───────────── Guides ───────────── */

export interface GuideSection {
  title: string;
  items: Array<{ label: string; text: string }>;
}

export interface OverwolfApp {
  name: string;
  url: string;
  description: string;
}

/** A card on /guides. */
export interface GuideSummary {
  game: GameSummary;
  intro: string;
  sectionTitles: string[];
  appCount: number;
  updatedAt: string;
}

export interface GuideDetail {
  game: GameDetail;
  intro: string;
  sections: GuideSection[];
  overwolfApps: OverwolfApp[];
  overwolfStoreUrl: string | null;
  updatedAt: string;
}

/** Admin → Guides: every published game, with its guide when it has one. */
export interface AdminGuideRow {
  game: GameRef;
  guide: {
    published: boolean;
    intro: string;
    sections: GuideSection[];
    overwolfApps: OverwolfApp[];
    overwolfStoreUrl: string | null;
    updatedAt: string;
  } | null;
}

export interface AdminAchievement {
  id: string;
  code: string;
  title: string;
  description: string;
  criteria: { kind: 'event_count'; event: TrackableEvent; count: number } | { kind: 'level'; level: number };
  xpReward: number;
  cosmetic: { kind: 'title' | 'badge'; value: string } | null;
  /** Players who have it. */
  unlocked: number;
}

export interface AdminSeason {
  key: string;
  title: string;
  description: string;
  goal: number;
  current: number;
  startsAt: string;
  endsAt: string;
  milestones: Array<{ percent: number; reward: string; reached: boolean }>;
  contributors: number;
  status: 'upcoming' | 'active' | 'ended';
}

export interface AdminXpAdjustment {
  id: string;
  player: { id: string; username: string; displayName: string };
  amount: number;
  reason: string;
  by: string | null;
  createdAt: string;
}

/* ───────────── Marketplace ───────────── */

export interface MarketPhoto {
  id: string;
  /** Up to 1600px on the long edge. */
  url: string;
  /** 480px square crop for grids. */
  thumbUrl: string;
  width: number;
  height: number;
}

/** How another player appears in lists, chats and cards. */
export interface PlayerRef {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  avatarUrl: string | null;
}

export type MarketSellerRef = PlayerRef;

export interface MarketSeller extends MarketSellerRef {
  region: TnRegion | null;
  level: number;
  joinedAt: string;
  activeListings: number;
  soldListings: number;
  reputation: SellerReputation;
}

/** How a seller has done on the marketplace. */
export interface SellerReputation {
  /** 1–5, one decimal; null until the first rating. */
  average: number | null;
  count: number;
  /** Ratings per star, index 0 = 1 star. */
  distribution: [number, number, number, number, number];
  /** Sales confirmed to a TG Hub buyer. */
  sales: number;
  verified: boolean;
}

export interface SavedSearch {
  id: string;
  name: string;
  criteria: SearchCriteria;
  /** Alert me when a new listing matches. */
  notify: boolean;
  /** Listings posted since the player last opened this search. */
  newCount: number;
  lastSeenAt: string;
  createdAt: string;
}

export interface SellerRating {
  id: string;
  stars: number;
  comment: string;
  buyer: PlayerRef;
  listing: { id: string; title: string };
  reply: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListingCard {
  id: string;
  title: string;
  /** Whole Tunisian dinars; 0 means free. */
  price: number;
  category: MarketCategory;
  subcategory: MarketSubcategory | null;
  digital: boolean;
  condition: MarketCondition | null;
  region: TnRegion | null;
  shipping: boolean;
  framework: FivemFramework | null;
  status: ListingStatus;
  photo: MarketPhoto | null;
  createdAt: string;
  /** Last time the seller listed or renewed it — what "Newest" sorts by. */
  bumpedAt: string;
  /** A paid boost is running. */
  featured: boolean;
}

export interface ListingDigitalInfo {
  framework: FivemFramework | null;
  delivery: AssetDelivery;
  source: AssetSource;
}

export interface ListingDetail extends ListingCard {
  description: string;
  negotiable: boolean;
  openToTrades: boolean;
  area: string;
  meetup: boolean;
  photos: MarketPhoto[];
  digitalInfo: ListingDigitalInfo | null;
  seller: MarketSeller;
  views: number;
  saves: number;
  updatedAt: string;
}

/** Per-viewer state, fetched separately so the listing itself stays cacheable. */
export interface ListingViewerState {
  isOwner: boolean;
  saved: boolean;
  reported: boolean;
  conversationId: string | null;
  /** When the owner may renew again (null = now). */
  renewableAt: string | null;
  /** The viewer bought this item and may rate the seller (until the edit window closes). */
  canRate: boolean;
  myRating: { stars: number; comment: string } | null;
  /** Owner only: players who messaged about the item, for "Who bought it?". */
  buyers: PlayerRef[];
}

export interface MyListing extends ListingCard {
  views: number;
  saves: number;
  conversations: number;
  renewableAt: string | null;
  moderationNote: string | null;
  /** Sold to this TG Hub player (null when sold elsewhere or not sold). */
  buyer: PlayerRef | null;
  featuredUntil: string | null;
}

export interface MyListings {
  items: MyListing[];
  counts: { active: number; pending: number; sold: number };
}

export interface MarketMessage {
  id: string;
  conversationId: string;
  senderId: string;
  mine: boolean;
  body: string;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  role: 'buyer' | 'seller';
  listing: Pick<ListingCard, 'id' | 'title' | 'price' | 'status' | 'photo'>;
  counterpart: MarketSellerRef;
  lastMessage: { body: string; mine: boolean; at: string } | null;
  unread: number;
  /** When the other side last had the thread open — drives "Seen" under your messages. */
  counterpartReadAt: string | null;
  updatedAt: string;
}

export interface MarketCategoryCount {
  category: MarketCategory;
  count: number;
}

export interface AdminListing extends ListingCard {
  seller: MarketSellerRef;
  flagged: boolean;
  reports: number;
  reportReasons: MarketReportReason[];
  moderationNote: string | null;
  updatedAt: string;
}

export interface AdminListingReport {
  id: string;
  reason: MarketReportReason;
  details: string;
  reporter: MarketSellerRef;
  createdAt: string;
}

/* ───────────── Admin dashboard ───────────── */

/** One Tunis-local day of activity. */
export interface AdminStatsPoint {
  day: string;
  signups: number;
  listings: number;
  messages: number;
  reports: number;
  xp: number;
  alerts: number;
}

export type AdminStatsMetric = Exclude<keyof AdminStatsPoint, 'day'>;

export interface AdminStats {
  days: number;
  /** Oldest first, one entry per day, zero-filled. */
  series: AdminStatsPoint[];
  totals: Record<AdminStatsMetric, number>;
  /** Same metrics over the window just before this one. */
  previous: Record<AdminStatsMetric, number>;
  listingsByCategory: MarketCategoryCount[];
  recentSignups: AdminUser[];
  recentListings: AdminListing[];
}

/* ───────────── Real-time ───────────── */

/**
 * Events on the signed-in player's live stream (GET /stream, server-sent
 * events). The stream only nudges: every payload is also reachable through
 * the regular endpoints, so a dropped connection loses nothing.
 */
export type RealtimeEvent =
  | { type: 'notification'; data: { notification: Notification; unreadCount: number } }
  | { type: 'market.message'; data: { conversationId: string; message: MarketMessage; from: MarketSellerRef; listingTitle: string } }
  | { type: 'market.typing'; data: { conversationId: string } }
  | { type: 'market.read'; data: { conversationId: string; readAt: string } };

export type RealtimeEventType = RealtimeEvent['type'];

export interface PushConfig {
  /** VAPID application server key; null when push isn't configured on this server. */
  publicKey: string | null;
}

/* ───────────── Squads ───────────── */

export interface ClanSummary {
  id: string;
  tag: string;
  name: string;
  color: string;
  description: string;
  joinPolicy: ClanJoinPolicy;
  country: CountryCode | null;
  games: GameRef[];
  memberCount: number;
  /** Members' combined XP, all time and in the current season. */
  xp: number;
  seasonXp: number;
  createdAt: string;
}

export interface ClanMember {
  user: PlayerRef & { level: number; country: CountryCode | null };
  role: ClanRole;
  joinedAt: string;
}

export interface ClanJoinRequest {
  id: string;
  user: PlayerRef & { level: number; country: CountryCode | null };
  message: string;
  createdAt: string;
}

export interface ClanDetail extends ClanSummary {
  members: ClanMember[];
  /** What the signed-in player can do here. */
  viewer: {
    role: ClanRole | null;
    /** Already in another clan (one clan per player). */
    otherClan: { tag: string; name: string } | null;
    requestPending: boolean;
  };
  /** Pending applications — leaders and officers only. */
  requests: ClanJoinRequest[];
}

export interface ClanBadge {
  tag: string;
  name: string;
  color: string;
  role: ClanRole;
}

export interface LfgPost {
  id: string;
  game: GameRef;
  platform: Platform;
  mode: string;
  rank: string;
  slots: number;
  /** Players accepted so far. */
  filled: number;
  languages: LfgLanguage[];
  micRequired: boolean;
  note: string;
  author: PlayerRef & { level: number; country: CountryCode | null; clanTag: string | null };
  status: 'open' | 'full' | 'closed';
  expiresAt: string;
  createdAt: string;
  viewer: {
    isAuthor: boolean;
    request: 'pending' | 'accepted' | 'declined' | null;
  };
  /** The author's contact — only for the author and accepted players. */
  contact: string | null;
  /** Applications waiting for the author's answer (author only, else 0). */
  pendingRequests: number;
}

export interface LfgRequest {
  id: string;
  user: PlayerRef & { level: number; country: CountryCode | null };
  message: string;
  contact: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

/* ───────────── Social ───────────── */

/** A player as shown in follower lists, suggestions and squads. */
export type PlayerCard = PlayerRef & { level: number; country: CountryCode | null };

export interface FollowStatus {
  following: boolean;
  /** They follow you too. */
  followsYou: boolean;
  followers: number;
}

/**
 * One line in the feed: "{actor} {text} {target}". The words are stored when
 * the activity happens, so the feed reads the same even if the target changes.
 */
export interface Activity {
  id: string;
  type: ActivityType;
  actor: PlayerCard;
  /** English sentence; clients word it themselves from `type` and `value`. */
  text: string;
  /** The number in the sentence: level reached, players wanted, listing price (TND). */
  value: number | null;
  target: { label: string; href: string } | null;
  /** Extra line under the sentence: a price, an XP reward. */
  detail: string | null;
  visual: { kind: 'image'; url: string } | { kind: 'mark'; label: string; color: string } | null;
  gg: number;
  /** The viewer already said GG. */
  ggByYou: boolean;
  createdAt: string;
}

/* ───────────── Connected accounts ───────────── */

/** Which sign-in / linking options this server has credentials for. */
export interface AuthProviders {
  discord: boolean;
  steam: boolean;
}

export interface DiscordConnection {
  id: string;
  username: string;
  avatarUrl: string | null;
  connectedAt: string;
}

export interface SteamConnection {
  id: string;
  personaName: string | null;
  profileUrl: string;
  avatarUrl: string | null;
  /** Owned games that are also in the TG Hub catalogue, most played first. */
  games: Array<{ game: GameRef; hours: number }>;
  gamesSyncedAt: string | null;
  connectedAt: string;
}

export interface Connections {
  discord: DiscordConnection | null;
  steam: SteamConnection | null;
  /** Discord is the only way into an account without a password; unlinking it then needs a password first. */
  canUnlinkDiscord: boolean;
  /** The server can read Steam libraries (it has a Steam Web API key). */
  steamGamesAvailable: boolean;
}

/* ───────────── Payments ───────────── */

export interface PaymentConfig {
  /** Which gateway takes payments; null = payments are off on this server. */
  provider: PaymentProvider | null;
  plans: Array<{ id: FeaturePlan; days: number; priceTnd: number; label: string }>;
}

export interface FeatureOrder {
  id: string;
  listing: { id: string; title: string; featuredUntil: string | null };
  plan: FeaturePlan;
  days: number;
  priceTnd: number;
  provider: PaymentProvider;
  status: OrderStatus;
  createdAt: string;
  paidAt: string | null;
}

export interface CheckoutStart {
  orderId: string;
  /** Where to send the player to pay. */
  payUrl: string;
}

export interface AdminOrder extends FeatureOrder {
  buyer: PlayerRef;
  providerRef: string | null;
}

export interface AdminPayments {
  orders: AdminOrder[];
  /** Paid revenue in TND. */
  revenue: { last30Days: number; allTime: number };
  provider: PaymentProvider | null;
}

/* ───────────── Monitoring ───────────── */

export interface AdminErrorEvent {
  id: string;
  source: 'api' | 'web';
  name: string;
  message: string;
  stack: string | null;
  where: string | null;
  count: number;
  /** Distinct signed-in players who hit it recently. */
  players: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
}

/* ───────────── Game data (IGDB) ───────────── */

/** One catalogue game as the admin sees it: where its data comes from and how fresh it is. */
export interface AdminGame {
  id: string;
  slug: string;
  title: string;
  coverUrl: string | null;
  status: 'published' | 'draft';
  igdbId: number | null;
  igdbUrl: string | null;
  igdbSyncedAt: string | null;
}

export interface AdminGames {
  games: AdminGame[];
  /** Whether the API has IGDB credentials. */
  igdbConfigured: boolean;
  lastSync: { at: string; updated: number; linked: number; failed: number } | null;
}

/** An IGDB search hit, with the catalogue game it's already linked to (if any). */
export interface IgdbSearchResult {
  igdbId: number;
  name: string;
  releaseYear: number | null;
  coverUrl: string | null;
  platforms: string[];
  igdbUrl: string;
  /** Slug of the catalogue game linked to this IGDB entry. */
  inCatalogue: string | null;
}

export interface IgdbSyncResult {
  updated: number;
  linked: number;
  failed: number;
  /** Catalogue games IGDB couldn't match automatically; link them by hand. */
  unmatched: string[];
}
