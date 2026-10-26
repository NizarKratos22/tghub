import type {
  Activity,
  AdminTournament,
  AdminAlert,
  AdminListing,
  AdminListingReport,
  AdminAchievement,
  AdminGuideRow,
  AdminMission,
  AdminSeason,
  AdminXpAdjustment,
  AdminOverview,
  AdminErrorEvent,
  AdminGames,
  GameDetail,
  AdminPayments,
  AdminStats,
  AdminUser,
  Achievement,
  AlertPreferences,
  AlertPreferencesUpdate,
  AlertSource,
  AuthProviders,
  CheckoutStart,
  AuthResult,
  BookmarkTarget,
  ClanBadge,
  ClanDetail,
  ClanInput,
  ClanSummary,
  ClanUpdateInput,
  CompatCheckInput,
  Connections,
  CompatibleGames,
  CompatResult,
  ConversationSummary,
  CountryStanding,
  ComponentBrand,
  ComponentSegment,
  ComponentType,
  CursorPage,
  DeliveryLog,
  DiscordTarget,
  EmailVerificationStatus,
  FeatureOrder,
  FeatureOrderInput,
  FollowStatus,
  GameSummary,
  HardwareComponent,
  LeaderboardEntry,
  ListingCard,
  ListingDetail,
  ListingInput,
  ListingReportInput,
  LfgJoinInput,
  LfgPost,
  LfgPostInput,
  LfgRequest,
  ListingViewerState,
  LoginInput,
  MarketMessage,
  MarketPhoto,
  Me,
  Mission,
  MyListing,
  MyListings,
  Notification,
  Page,
  PaymentConfig,
  PcSpec,
  PlayerCard,
  ProgressionSnapshot,
  PublishAlertResult,
  Pulse,
  PushConfig,
  PushSubscriptionInput,
  RadarSearchResult,
  RegionStanding,
  RegisterInput,
  Resource,
  RigPreset,
  SavedSearch,
  SavedSearchInput,
  SellerListingStatus,
  SellerRating,
  SellerRatingInput,
  SellerReputation,
  SessionInfo,
  SourceRunResult,
  StartggVideogame,
  TournamentImportResult,
  TournamentProviderInfo,
  TournamentSource,
  TournamentSourceRunResult,
  TournamentSummary,
  UpdateProfileInput,
  XpEntry,
  IgdbSearchResult,
  IgdbSyncResult,
} from '@tgh/shared';
import { isLocale } from '@/i18n/config';
import { DICTIONARIES } from '@/i18n/dictionaries';
import { toQueryString, type QueryParams } from './query';

const BASE = '/api/v1';

/** The page's language (the root layout sets <html lang>), for the few words written outside React. */
const pageWords = () => DICTIONARIES[typeof document !== 'undefined' && isLocale(document.documentElement.lang) ? document.documentElement.lang : 'en'];

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Field-level messages keyed by input name ("deal.price"). */
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time, shared by every request that hit a 401 meanwhile. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'x-tgh-csrf': '1' },
  })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: QueryParams;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}, retry = true): Promise<T> {
  const response = await fetch(`${BASE}${path}${toQueryString(options.query)}`, {
    method: options.method ?? 'GET',
    credentials: 'same-origin',
    headers: {
      'x-tgh-csrf': '1',
      ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refreshSession()) return apiFetch<T>(path, options, false);
  }
  if (response.status === 204) return undefined as T;

  const payload = (await response.json().catch(() => null)) as
    | { data: T }
    | { error: { code: string; message: string; details?: { fields?: Record<string, string> } } }
    | null;

  if (!response.ok || !payload || 'error' in payload) {
    const error = payload && 'error' in payload ? payload.error : null;
    throw new ApiError(
      response.status,
      error?.code ?? 'NETWORK_ERROR',
      error?.message ?? pageWords().errors.offline,
      error?.details?.fields ?? {},
    );
  }
  return payload.data;
}

/** Multipart upload; the browser sets the boundary header itself. */
async function uploadFile<T>(path: string, file: Blob, fields: Record<string, string> = {}, retry = true): Promise<T> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  form.set('file', file, file instanceof File ? file.name : 'image');
  const response = await fetch(`${BASE}${path}`, { method: 'POST', credentials: 'same-origin', headers: { 'x-tgh-csrf': '1' }, body: form });
  if (response.status === 401 && retry && (await refreshSession())) return uploadFile<T>(path, file, fields, false);
  const payload = (await response.json().catch(() => null)) as
    | { data: T }
    | { error: { code: string; message: string; details?: { fields?: Record<string, string> } } }
    | null;
  if (!response.ok || !payload || 'error' in payload) {
    const error = payload && 'error' in payload ? payload.error : null;
    throw new ApiError(response.status, error?.code ?? 'NETWORK_ERROR', error?.message ?? 'Upload failed — check your connection', error?.details?.fields ?? {});
  }
  return payload.data;
}

/** Typed endpoint map — the only place the web app spells out API paths. */
export const api = {
  auth: {
    login: (body: LoginInput) => apiFetch<AuthResult>('/auth/login', { method: 'POST', body }),
    register: (body: RegisterInput) => apiFetch<AuthResult>('/auth/register', { method: 'POST', body }),
    logout: () => apiFetch<void>('/auth/logout', { method: 'POST', body: {} }),
    usernameAvailable: (username: string) => apiFetch<{ available: boolean }>('/auth/username-available', { query: { username } }),
    verification: () => apiFetch<EmailVerificationStatus | { verified: true }>('/auth/verify-email'),
    verifyEmail: (code: string) => apiFetch<Me>('/auth/verify-email', { method: 'POST', body: { code } }),
    providers: () => apiFetch<AuthProviders>('/auth/providers'),
    resendCode: () => apiFetch<EmailVerificationStatus | { verified: true }>('/auth/verify-email/resend', { method: 'POST', body: {} }),
    forgotPassword: (email: string) => apiFetch<{ sent: true; devCode?: string }>('/auth/password/forgot', { method: 'POST', body: { email } }),
    resetPassword: (body: { email: string; code: string; password: string }) => apiFetch<AuthResult>('/auth/password/reset', { method: 'POST', body }),
  },
  me: {
    get: () => apiFetch<Me>('/me'),
    update: (body: UpdateProfileInput) => apiFetch<Me>('/me', { method: 'PATCH', body }),
    changePassword: (body: { currentPassword: string; newPassword: string }) => apiFetch<void>('/me/password', { method: 'PUT', body }),
    changeEmail: (body: { email: string; password: string }) => apiFetch<EmailVerificationStatus>('/me/email', { method: 'POST', body }),
    confirmEmail: (code: string) => apiFetch<Me>('/me/email/confirm', { method: 'POST', body: { code } }),
    sessions: () => apiFetch<SessionInfo[]>('/me/sessions'),
    revokeSession: (id: string) => apiFetch<void>(`/me/sessions/${id}`, { method: 'DELETE' }),
    revokeOtherSessions: () => apiFetch<{ revoked: number }>('/me/sessions/revoke-others', { method: 'POST', body: {} }),
    equipTitle: (title: string | null) => apiFetch<Me>('/me/title', { method: 'PUT', body: { title } }),
    uploadImage: (kind: 'avatar' | 'banner', image: Blob) => uploadFile<Me>(`/me/${kind}`, image),
    connections: () => apiFetch<Connections>('/me/connections'),
    unlink: (provider: 'discord' | 'steam') => apiFetch<Connections>(`/me/connections/${provider}`, { method: 'DELETE' }),
    syncSteam: () => apiFetch<Connections>('/me/connections/steam/sync', { method: 'POST' }),
    removeImage: (kind: 'avatar' | 'banner') => apiFetch<Me>(`/me/${kind}`, { method: 'DELETE' }),
    bookmarkIds: (targetType: BookmarkTarget) => apiFetch<string[]>('/me/bookmarks/ids', { query: { targetType } }),
    addBookmark: (targetType: BookmarkTarget, targetId: string) =>
      apiFetch<void>('/me/bookmarks', { method: 'POST', body: { targetType, targetId } }),
    removeBookmark: (targetType: BookmarkTarget, targetId: string) =>
      apiFetch<void>(`/me/bookmarks/${targetType}/${targetId}`, { method: 'DELETE' }),
    favoriteGames: () => apiFetch<GameSummary[]>('/me/favorites/games'),
    recentGames: () => apiFetch<GameSummary[]>('/me/recent/games'),
  },
  games: {
    list: (query: QueryParams) => apiFetch<Page<GameSummary>>('/games', { query }),
    recordView: (slug: string) => apiFetch<{ firstToday: boolean }>(`/games/${slug}/view`, { method: 'POST' }),
  },
  radar: {
    list: (query: QueryParams) => apiFetch<Page<Resource>>('/radar', { query }),
    search: (q: string, options: { track?: boolean } = {}) =>
      apiFetch<RadarSearchResult>('/radar/search', { query: { q, track: options.track === false ? 'false' : undefined } }),
  },
  tournaments: {
    following: () => apiFetch<TournamentSummary[]>('/tournaments/following'),
    followingIds: () => apiFetch<string[]>('/tournaments/following/ids'),
    follow: (slug: string) => apiFetch<void>(`/tournaments/${slug}/follow`, { method: 'POST' }),
    unfollow: (slug: string) => apiFetch<void>(`/tournaments/${slug}/follow`, { method: 'DELETE' }),
  },
  market: {
    listings: (query: QueryParams) => apiFetch<Page<ListingCard>>('/market/listings', { query }),
    listing: (id: string) => apiFetch<ListingDetail>(`/market/listings/${id}`),
    viewer: (id: string) => apiFetch<ListingViewerState>(`/market/listings/${id}/viewer`),
    recordView: (id: string) => apiFetch<void>(`/market/listings/${id}/view`, { method: 'POST' }),
    create: (body: ListingInput) => apiFetch<ListingDetail>('/market/listings', { method: 'POST', body }),
    update: (id: string, body: ListingInput) => apiFetch<ListingDetail>(`/market/listings/${id}`, { method: 'PUT', body }),
    setStatus: (id: string, status: SellerListingStatus, buyerId?: string | null) =>
      apiFetch<MyListing>(`/market/listings/${id}/status`, { method: 'PATCH', body: buyerId === undefined ? { status } : { status, buyerId } }),
    rate: (id: string, body: SellerRatingInput) => apiFetch<{ stars: number; comment: string }>(`/market/listings/${id}/rating`, { method: 'POST', body }),
    sellerRatings: (username: string, before?: string) =>
      apiFetch<CursorPage<SellerRating> & { reputation: SellerReputation }>(`/market/sellers/${username}/ratings`, { query: { before } }),
    replyRating: (id: string, reply: string) => apiFetch<SellerRating>(`/market/ratings/${id}/reply`, { method: 'POST', body: { reply } }),
    searches: () => apiFetch<SavedSearch[]>('/market/searches'),
    saveSearch: (body: SavedSearchInput) => apiFetch<SavedSearch>('/market/searches', { method: 'POST', body }),
    updateSearch: (id: string, body: { name?: string; notify?: boolean }) => apiFetch<SavedSearch>(`/market/searches/${id}`, { method: 'PATCH', body }),
    searchSeen: (id: string) => apiFetch<SavedSearch>(`/market/searches/${id}/seen`, { method: 'POST' }),
    deleteSearch: (id: string) => apiFetch<void>(`/market/searches/${id}`, { method: 'DELETE' }),
    renew: (id: string) => apiFetch<MyListing>(`/market/listings/${id}/renew`, { method: 'POST' }),
    remove: (id: string) => apiFetch<void>(`/market/listings/${id}`, { method: 'DELETE' }),
    report: (id: string, body: ListingReportInput) => apiFetch<void>(`/market/listings/${id}/report`, { method: 'POST', body }),
    messageSeller: (id: string, body: string) =>
      apiFetch<{ conversationId: string; message: MarketMessage }>(`/market/listings/${id}/messages`, { method: 'POST', body: { body } }),
    mine: (status?: SellerListingStatus) => apiFetch<MyListings>('/market/me/listings', { query: { status } }),
    saved: () => apiFetch<ListingCard[]>('/market/saved'),
    conversations: (role: 'all' | 'buying' | 'selling') => apiFetch<ConversationSummary[]>('/market/conversations', { query: { role } }),
    conversation: (id: string) => apiFetch<ConversationSummary>(`/market/conversations/${id}`),
    messages: (id: string, before?: string) => apiFetch<CursorPage<MarketMessage>>(`/market/conversations/${id}/messages`, { query: { before } }),
    send: (id: string, body: string) => apiFetch<MarketMessage>(`/market/conversations/${id}/messages`, { method: 'POST', body: { body } }),
    markRead: (id: string) => apiFetch<void>(`/market/conversations/${id}/read`, { method: 'POST' }),
    typing: (id: string) => apiFetch<void>(`/market/conversations/${id}/typing`, { method: 'POST' }),
    uploadPhoto: (file: File) => uploadFile<MarketPhoto>('/media', file, { purpose: 'listing' }),
  },
  pc: {
    components: (type: ComponentType, filters: { q?: string; brand?: ComponentBrand; segment?: ComponentSegment; limit?: number }) =>
      apiFetch<HardwareComponent[]>('/pc/components', { query: { type, limit: 24, ...filters } }),
    matchComponent: (type: ComponentType, name: string) => apiFetch<HardwareComponent | null>('/pc/components/match', { query: { type, name } }),
    presets: () => apiFetch<RigPreset[]>('/pc/presets'),
    specs: () => apiFetch<PcSpec[]>('/pc/specs'),
    createSpec: (body: unknown) => apiFetch<PcSpec>('/pc/specs', { method: 'POST', body }),
    updateSpec: (id: string, body: unknown) => apiFetch<PcSpec>(`/pc/specs/${id}`, { method: 'PATCH', body }),
    deleteSpec: (id: string) => apiFetch<void>(`/pc/specs/${id}`, { method: 'DELETE' }),
    check: (body: CompatCheckInput) => apiFetch<CompatResult>('/pc/check', { method: 'POST', body }),
    compatibleGames: (query: QueryParams) => apiFetch<CompatibleGames>('/pc/compatible-games', { query }),
  },
  universe: {
    me: () => apiFetch<ProgressionSnapshot>('/universe/me'),
    missions: () => apiFetch<Mission[]>('/universe/missions'),
    claim: (id: string) =>
      apiFetch<{ mission: Mission; progression: ProgressionSnapshot }>(`/universe/missions/${id}/claim`, { method: 'POST' }),
    achievements: () => apiFetch<Achievement[]>('/universe/achievements'),
    xpHistory: () => apiFetch<XpEntry[]>('/universe/xp-history'),
    pulse: () => apiFetch<Pulse | null>('/universe/pulse'),
    leaderboard: () => apiFetch<LeaderboardEntry[]>('/universe/leaderboard'),
    regions: () => apiFetch<RegionStanding[]>('/universe/regions'),
    countries: () => apiFetch<CountryStanding[]>('/universe/countries'),
  },
  alerts: {
    inbox: (query: QueryParams) => apiFetch<CursorPage<Notification>>('/alerts/inbox', { query }),
    markRead: (id: string) => apiFetch<void>(`/alerts/inbox/${id}/read`, { method: 'POST' }),
    markAllRead: () => apiFetch<{ updated: number }>('/alerts/inbox/read-all', { method: 'POST' }),
    preferences: () => apiFetch<AlertPreferences>('/alerts/preferences'),
    updatePreferences: (body: AlertPreferencesUpdate) =>
      apiFetch<AlertPreferences>('/alerts/preferences', { method: 'PATCH', body }),
  },
  social: {
    feed: (before?: string) => apiFetch<CursorPage<Activity>>('/feed', { query: { before } }),
    suggestions: () => apiFetch<PlayerCard[]>('/feed/suggestions'),
    gg: (activityId: string) => apiFetch<{ gg: number; ggByYou: boolean }>(`/feed/${activityId}/gg`, { method: 'POST' }),
    status: (username: string) => apiFetch<FollowStatus>(`/users/${username}/follow`),
    follow: (username: string) => apiFetch<FollowStatus>(`/users/${username}/follow`, { method: 'POST' }),
    unfollow: (username: string) => apiFetch<FollowStatus>(`/users/${username}/follow`, { method: 'DELETE' }),
    followers: (username: string, before?: string) => apiFetch<CursorPage<PlayerCard>>(`/users/${username}/followers`, { query: { before } }),
    following: (username: string, before?: string) => apiFetch<CursorPage<PlayerCard>>(`/users/${username}/following`, { query: { before } }),
    activity: (username: string, before?: string) => apiFetch<CursorPage<Activity>>(`/users/${username}/activity`, { query: { before } }),
  },
  clans: {
    list: (query: QueryParams) => apiFetch<Page<ClanSummary>>('/clans', { query }),
    mine: () => apiFetch<{ clan: ClanBadge | null }>('/clans/mine'),
    get: (tag: string) => apiFetch<ClanDetail>(`/clans/${tag}`),
    create: (body: ClanInput) => apiFetch<ClanDetail>('/clans', { method: 'POST', body }),
    update: (tag: string, body: ClanUpdateInput) => apiFetch<ClanDetail>(`/clans/${tag}`, { method: 'PATCH', body }),
    disband: (tag: string) => apiFetch<void>(`/clans/${tag}`, { method: 'DELETE' }),
    join: (tag: string, message: string) => apiFetch<ClanDetail>(`/clans/${tag}/join`, { method: 'POST', body: { message } }),
    withdraw: (tag: string) => apiFetch<ClanDetail>(`/clans/${tag}/application`, { method: 'DELETE' }),
    leave: (tag: string) => apiFetch<void>(`/clans/${tag}/leave`, { method: 'POST' }),
    decide: (tag: string, requestId: string, accept: boolean) =>
      apiFetch<ClanDetail>(`/clans/${tag}/requests/${requestId}`, { method: 'POST', body: { accept } }),
    setRole: (tag: string, userId: string, role: 'officer' | 'member') =>
      apiFetch<ClanDetail>(`/clans/${tag}/members/${userId}`, { method: 'PATCH', body: { role } }),
    makeLeader: (tag: string, userId: string) => apiFetch<ClanDetail>(`/clans/${tag}/members/${userId}/leader`, { method: 'POST' }),
    remove: (tag: string, userId: string) => apiFetch<ClanDetail>(`/clans/${tag}/members/${userId}`, { method: 'DELETE' }),
  },
  lfg: {
    list: (query: QueryParams) => apiFetch<Page<LfgPost>>('/lfg', { query }),
    get: (id: string) => apiFetch<LfgPost>(`/lfg/${id}`),
    create: (body: LfgPostInput) => apiFetch<LfgPost>('/lfg', { method: 'POST', body }),
    close: (id: string) => apiFetch<LfgPost>(`/lfg/${id}/close`, { method: 'POST' }),
    apply: (id: string, body: LfgJoinInput) => apiFetch<LfgPost>(`/lfg/${id}/requests`, { method: 'POST', body }),
    withdraw: (id: string) => apiFetch<LfgPost>(`/lfg/${id}/requests/mine`, { method: 'DELETE' }),
    requests: (id: string) => apiFetch<LfgRequest[]>(`/lfg/${id}/requests`),
    decide: (id: string, requestId: string, accept: boolean) =>
      apiFetch<LfgRequest[]>(`/lfg/${id}/requests/${requestId}`, { method: 'POST', body: { accept } }),
  },
  payments: {
    config: () => apiFetch<PaymentConfig>('/payments/config'),
    feature: (body: FeatureOrderInput) => apiFetch<CheckoutStart>('/payments/featured', { method: 'POST', body }),
    order: (id: string) => apiFetch<FeatureOrder>(`/payments/orders/${id}`),
    devComplete: (id: string, outcome: 'paid' | 'failed') => apiFetch<FeatureOrder>(`/payments/dev/${id}/${outcome}`, { method: 'POST' }),
  },
  push: {
    config: () => apiFetch<PushConfig>('/push/config'),
    subscribe: (body: PushSubscriptionInput) => apiFetch<void>('/push/subscriptions', { method: 'POST', body }),
    unsubscribe: (endpoint: string) => apiFetch<void>('/push/subscriptions', { method: 'DELETE', body: { endpoint } }),
  },
  admin: {
    overview: () => apiFetch<AdminOverview>('/admin/overview'),
    stats: (days: number) => apiFetch<AdminStats>('/admin/stats', { query: { days } }),
    alerts: () => apiFetch<AdminAlert[]>('/admin/alerts'),
    publishAlert: (body: unknown) => apiFetch<PublishAlertResult>('/admin/alerts', { method: 'POST', body }),
    testAlert: () => apiFetch<PublishAlertResult>('/admin/alerts/test', { method: 'POST' }),
    deliveryLogs: () => apiFetch<DeliveryLog[]>('/admin/delivery-logs', { query: { limit: 50 } }),
    sources: () => apiFetch<AlertSource[]>('/admin/sources'),
    createSource: (body: unknown) => apiFetch<AlertSource>('/admin/sources', { method: 'POST', body }),
    updateSource: (id: string, body: unknown) => apiFetch<AlertSource>(`/admin/sources/${id}`, { method: 'PATCH', body }),
    deleteSource: (id: string) => apiFetch<void>(`/admin/sources/${id}`, { method: 'DELETE' }),
    runSource: (id: string) => apiFetch<SourceRunResult>(`/admin/sources/${id}/run`, { method: 'POST' }),
    discordTargets: () => apiFetch<DiscordTarget[]>('/admin/discord-targets'),
    createDiscordTarget: (body: unknown) => apiFetch<DiscordTarget>('/admin/discord-targets', { method: 'POST', body }),
    updateDiscordTarget: (id: string, body: unknown) =>
      apiFetch<DiscordTarget>(`/admin/discord-targets/${id}`, { method: 'PATCH', body }),
    deleteDiscordTarget: (id: string) => apiFetch<void>(`/admin/discord-targets/${id}`, { method: 'DELETE' }),
    testDiscordTarget: (id: string) => apiFetch<DiscordTarget>(`/admin/discord-targets/${id}/test`, { method: 'POST' }),
    users: (query: QueryParams) => apiFetch<Page<AdminUser>>('/admin/users', { query }),
    updateUser: (id: string, body: unknown) => apiFetch<AdminUser>(`/admin/users/${id}`, { method: 'PATCH', body }),
    clearUserImages: (id: string) => apiFetch<AdminUser>(`/admin/users/${id}/images`, { method: 'DELETE' }),
    payments: () => apiFetch<AdminPayments>('/admin/payments'),
    games: () => apiFetch<AdminGames>('/admin/games'),
    igdbSearch: (q: string) => apiFetch<IgdbSearchResult[]>('/admin/igdb/search', { query: { q } }),
    igdbImport: (igdbId: number) => apiFetch<GameDetail>('/admin/igdb/import', { method: 'POST', body: { igdbId } }),
    igdbSync: () => apiFetch<IgdbSyncResult>('/admin/igdb/sync', { method: 'POST' }),
    linkIgdb: (gameId: string, igdbId: number) => apiFetch<GameDetail>(`/admin/games/${gameId}/igdb`, { method: 'PUT', body: { igdbId } }),
    errors: (status: 'open' | 'resolved') => apiFetch<AdminErrorEvent[]>('/admin/errors', { query: { status } }),
    resolveError: (id: string, resolved: boolean) => apiFetch<AdminErrorEvent>(`/admin/errors/${id}/resolve`, { method: 'POST', body: { resolved } }),
    setSellerVerification: (id: string, override: AdminUser['sellerOverride']) =>
      apiFetch<void>(`/admin/users/${id}/seller-verification`, { method: 'PUT', body: { override } }),
    missions: () => apiFetch<AdminMission[]>('/admin/missions'),
    updateMission: (id: string, body: unknown) => apiFetch<AdminMission>(`/admin/missions/${id}`, { method: 'PATCH', body }),
    createMission: (body: unknown) => apiFetch<AdminMission>('/admin/missions', { method: 'POST', body }),
    deleteMission: (id: string) => apiFetch<void>(`/admin/missions/${id}`, { method: 'DELETE' }),
    achievements: () => apiFetch<AdminAchievement[]>('/admin/achievements'),
    createAchievement: (body: unknown) => apiFetch<AdminAchievement>('/admin/achievements', { method: 'POST', body }),
    updateAchievement: (id: string, body: unknown) => apiFetch<AdminAchievement>(`/admin/achievements/${id}`, { method: 'PUT', body }),
    deleteAchievement: (id: string) => apiFetch<void>(`/admin/achievements/${id}`, { method: 'DELETE' }),
    seasons: () => apiFetch<AdminSeason[]>('/admin/seasons'),
    createSeason: (body: unknown) => apiFetch<AdminSeason>('/admin/seasons', { method: 'POST', body }),
    updateSeason: (key: string, body: unknown) => apiFetch<AdminSeason>(`/admin/seasons/${encodeURIComponent(key)}`, { method: 'PUT', body }),
    xpAdjustments: () => apiFetch<AdminXpAdjustment[]>('/admin/xp'),
    guides: () => apiFetch<AdminGuideRow[]>('/admin/guides'),
    saveGuide: (gameId: string, body: unknown) => apiFetch<void>(`/admin/guides/${gameId}`, { method: 'PUT', body }),
    deleteGuide: (gameId: string) => apiFetch<void>(`/admin/guides/${gameId}`, { method: 'DELETE' }),
    adjustXp: (body: unknown) => apiFetch<AdminXpAdjustment>('/admin/xp', { method: 'POST', body }),
    createResource: (body: unknown) => apiFetch<Resource>('/admin/resources', { method: 'POST', body }),
    deleteResource: (id: string) => apiFetch<void>(`/admin/resources/${id}`, { method: 'DELETE' }),
    market: {
      listings: (query: QueryParams) => apiFetch<Page<AdminListing>>('/admin/market/listings', { query }),
      update: (id: string, body: unknown) => apiFetch<AdminListing>(`/admin/market/listings/${id}`, { method: 'PATCH', body }),
      reports: (id: string) => apiFetch<AdminListingReport[]>(`/admin/market/listings/${id}/reports`),
    },
    tournaments: {
      providers: () => apiFetch<TournamentProviderInfo[]>('/admin/tournaments/providers'),
      list: (query: QueryParams) => apiFetch<Page<AdminTournament>>('/admin/tournaments', { query }),
      update: (id: string, body: unknown) => apiFetch<AdminTournament>(`/admin/tournaments/${id}`, { method: 'PATCH', body }),
      sync: (id: string) => apiFetch<TournamentSummary>(`/admin/tournaments/${id}/sync`, { method: 'POST' }),
      import: (url: string) => apiFetch<TournamentImportResult>('/admin/tournaments/import', { method: 'POST', body: { url } }),
      sources: () => apiFetch<TournamentSource[]>('/admin/tournaments/sources'),
      createSource: (body: unknown) => apiFetch<TournamentSource>('/admin/tournaments/sources', { method: 'POST', body }),
      updateSource: (id: string, body: unknown) =>
        apiFetch<TournamentSource>(`/admin/tournaments/sources/${id}`, { method: 'PATCH', body }),
      deleteSource: (id: string) => apiFetch<void>(`/admin/tournaments/sources/${id}`, { method: 'DELETE' }),
      runSource: (id: string) => apiFetch<TournamentSourceRunResult>(`/admin/tournaments/sources/${id}/run`, { method: 'POST' }),
      startggGames: (q: string) => apiFetch<StartggVideogame[]>('/admin/tournaments/startgg/videogames', { query: { q } }),
    },
  },
};
