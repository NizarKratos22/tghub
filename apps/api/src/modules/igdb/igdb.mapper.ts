import { z } from 'zod';
import type { GameMode, Genre, Platform } from '@tgh/shared';

/** Everything the catalogue takes from one IGDB game, in one request. */
export const IGDB_GAME_FIELDS = [
  'name',
  'slug',
  'url',
  'summary',
  'first_release_date',
  'game_type',
  'cover.image_id',
  'artworks.image_id',
  'screenshots.image_id',
  'videos.video_id',
  'genres.slug',
  'themes.slug',
  'game_modes.slug',
  'player_perspectives.slug',
  'platforms',
  'involved_companies.company.name',
  'involved_companies.developer',
  'involved_companies.publisher',
  'websites.url',
  'websites.type',
  'total_rating',
  'total_rating_count',
  'alternative_names.name',
  'language_supports.language.name',
  'keywords.slug',
  'external_games.uid',
  'external_games.external_game_source',
].join(',');

/** Main games and the kinds of release that stand in for one (standalone expansions, remakes, remasters, expanded editions, ports). */
export const IGDB_PLAYABLE_GAME_TYPES = [0, 4, 8, 9, 10, 11] as const;

export type IgdbImageSize = 'cover_small' | 'cover_big' | 'cover_big_2x' | 'screenshot_med' | 'screenshot_big' | '720p' | '1080p';

/** IGDB's image CDN; WebP is served for every size and cached for a year. */
export const igdbImage = (imageId: string, size: IgdbImageSize): string => `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.webp`;

const slugged = z.array(z.object({ slug: z.string() })).nullish();
const images = z.array(z.object({ image_id: z.string() })).nullish();

export const igdbGameSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  slug: z.string(),
  url: z.string().nullish(),
  summary: z.string().nullish(),
  first_release_date: z.number().nullish(),
  game_type: z.number().nullish(),
  cover: z.object({ image_id: z.string() }).nullish(),
  artworks: images,
  screenshots: images,
  videos: z.array(z.object({ video_id: z.string() })).nullish(),
  genres: slugged,
  themes: slugged,
  game_modes: slugged,
  player_perspectives: slugged,
  platforms: z.array(z.number()).nullish(),
  involved_companies: z
    .array(z.object({ company: z.object({ name: z.string() }).nullish(), developer: z.boolean().nullish(), publisher: z.boolean().nullish() }))
    .nullish(),
  websites: z.array(z.object({ url: z.string(), type: z.number().nullish() })).nullish(),
  total_rating: z.number().nullish(),
  total_rating_count: z.number().nullish(),
  alternative_names: z.array(z.object({ name: z.string() })).nullish(),
  language_supports: z.array(z.object({ language: z.object({ name: z.string() }).nullish() })).nullish(),
  keywords: slugged,
  external_games: z.array(z.object({ uid: z.string().nullish(), external_game_source: z.number().nullish() })).nullish(),
});
export type IgdbRawGame = z.infer<typeof igdbGameSchema>;

/** One IGDB game in the catalogue's own terms. */
export interface IgdbGame {
  igdbId: number;
  name: string;
  slug: string;
  url: string;
  summary: string;
  releaseDate: Date | null;
  developer: string;
  publisher: string;
  genres: Genre[];
  platforms: Platform[];
  modes: GameMode[];
  languages: string[];
  links: { official: string | null; store: string | null };
  steamAppId: number | null;
  freeToPlay: boolean;
  coverId: string | null;
  artworkIds: string[];
  screenshotIds: string[];
  videoIds: string[];
  /** 0–100, only once enough people have rated it to mean something. */
  rating: number | null;
  ratingCount: number;
  /** Other names players search for ("cs2", "counter strike 2"), lower-cased. */
  altNames: string[];
}

const PLATFORM_IDS: Record<Platform, number[]> = {
  pc: [6, 3, 14], // Windows, Linux, Mac
  playstation: [48, 167, 9], // PS4, PS5, PS3
  xbox: [49, 169, 12], // One, Series X|S, 360
  switch: [130, 508], // Switch, Switch 2
  mobile: [34, 39], // Android, iOS
};

const MODE_SLUGS: Record<string, GameMode> = {
  'single-player': 'single-player',
  multiplayer: 'multiplayer',
  'co-operative': 'co-op',
  'split-screen': 'split-screen',
  'massively-multiplayer-online-mmo': 'mmo',
  'battle-royale': 'battle-royale',
};

/** Website types: official site, then the stores players buy from. */
const OFFICIAL_SITE = 1;
const STORE_PRIORITY = [13, 16, 17]; // Steam, Epic Games, GOG
const STEAM_SOURCE = 1;
const FREE_TO_PLAY_KEYWORDS = new Set(['free-to-play', 'f2p']);
/** Languages Tunisian players look for come first in the list. */
const LANGUAGE_PRIORITY = ['Arabic', 'French', 'English'];
const MIN_RATINGS = 5;

const slugs = (items: Array<{ slug: string }> | null | undefined) => new Set((items ?? []).map((item) => item.slug));

/**
 * IGDB's genres, themes, modes and perspectives in TG Hub's genre list. "Hero
 * shooter" has no IGDB equivalent, so it's kept from the catalogue (see the sync).
 */
export function mapGenres(raw: Pick<IgdbRawGame, 'genres' | 'themes' | 'game_modes' | 'player_perspectives'>): Genre[] {
  const genres = slugs(raw.genres);
  const themes = slugs(raw.themes);
  const modes = slugs(raw.game_modes);
  const perspectives = slugs(raw.player_perspectives);
  const out = new Set<Genre>();
  if (genres.has('shooter') && perspectives.has('first-person')) out.add('fps');
  if (modes.has('battle-royale')) out.add('battle-royale');
  if (genres.has('moba')) out.add('moba');
  if (genres.has('sport')) out.add('sports');
  if (genres.has('racing')) out.add('racing');
  if (genres.has('fighting')) out.add('fighting');
  if (genres.has('role-playing-rpg')) out.add('rpg');
  if (genres.has('strategy') || genres.has('real-time-strategy-rts') || genres.has('turn-based-strategy-tbs')) out.add('strategy');
  if (themes.has('sandbox')) out.add('sandbox');
  // "Action" only when nothing more specific applies; on a shooter it says nothing.
  if (out.size === 0 && (themes.has('action') || genres.has('shooter') || genres.has('hack-and-slash-beat-em-up') || genres.has('adventure'))) out.add('action');
  return [...out];
}

export function mapPlatforms(ids: number[] | null | undefined): Platform[] {
  const present = new Set(ids ?? []);
  return (Object.keys(PLATFORM_IDS) as Platform[]).filter((platform) => PLATFORM_IDS[platform].some((id) => present.has(id)));
}

export function mapModes(raw: IgdbRawGame['game_modes']): GameMode[] {
  return [...new Set((raw ?? []).map((mode) => MODE_SLUGS[mode.slug]).filter((mode): mode is GameMode => Boolean(mode)))];
}

function companies(raw: IgdbRawGame['involved_companies'], role: 'developer' | 'publisher'): string {
  const names = [...new Set((raw ?? []).filter((entry) => entry[role] && entry.company).map((entry) => entry.company!.name))];
  return names.slice(0, 2).join(', ').slice(0, 80);
}

function languages(raw: IgdbRawGame['language_supports']): string[] {
  const names = [...new Set((raw ?? []).flatMap((entry) => (entry.language ? [entry.language.name] : [])))];
  const rank = (name: string) => {
    const index = LANGUAGE_PRIORITY.indexOf(name);
    return index === -1 ? LANGUAGE_PRIORITY.length : index;
  };
  return names.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).slice(0, 24);
}

function altNames(raw: IgdbRawGame['alternative_names'], name: string): string[] {
  const own = name.toLowerCase();
  const names = (raw ?? [])
    .map((entry) => entry.name.trim().toLowerCase())
    // Printable Latin only (that's what players type here), no file names, nothing absurdly long.
    .filter((alt) => alt !== own && alt.length <= 40 && /^[\x20-\x7e]+$/.test(alt) && !/\.exe$/.test(alt));
  return [...new Set(names)].slice(0, 15);
}

/** Collapses the summary's whitespace; IGDB text is plain but sometimes double-spaced. */
const plain = (text: string | null | undefined, max: number) => (text ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function mapIgdbGame(raw: IgdbRawGame): IgdbGame {
  const websites = raw.websites ?? [];
  const store = STORE_PRIORITY.map((type) => websites.find((site) => site.type === type)?.url).find(Boolean) ?? null;
  const steamUid = (raw.external_games ?? []).find((entry) => entry.external_game_source === STEAM_SOURCE && entry.uid)?.uid;
  const ratingCount = Math.round(raw.total_rating_count ?? 0);
  return {
    igdbId: raw.id,
    name: raw.name.trim(),
    slug: raw.slug,
    url: raw.url ?? `https://www.igdb.com/games/${raw.slug}`,
    summary: plain(raw.summary, 4000),
    releaseDate: raw.first_release_date ? new Date(raw.first_release_date * 1000) : null,
    developer: companies(raw.involved_companies, 'developer'),
    publisher: companies(raw.involved_companies, 'publisher'),
    genres: mapGenres(raw),
    platforms: mapPlatforms(raw.platforms),
    modes: mapModes(raw.game_modes),
    languages: languages(raw.language_supports),
    links: { official: websites.find((site) => site.type === OFFICIAL_SITE)?.url ?? null, store },
    steamAppId: steamUid && /^\d+$/.test(steamUid) ? Number(steamUid) : null,
    freeToPlay: (raw.keywords ?? []).some((keyword) => FREE_TO_PLAY_KEYWORDS.has(keyword.slug)),
    coverId: raw.cover?.image_id ?? null,
    artworkIds: (raw.artworks ?? []).map((art) => art.image_id).slice(0, 6),
    screenshotIds: (raw.screenshots ?? []).map((shot) => shot.image_id).slice(0, 12),
    videoIds: (raw.videos ?? []).map((video) => video.video_id).filter((id) => /^[\w-]{6,20}$/.test(id)).slice(0, 4),
    rating: raw.total_rating !== null && raw.total_rating !== undefined && ratingCount >= MIN_RATINGS ? Math.round(raw.total_rating) : null,
    ratingCount,
    altNames: altNames(raw.alternative_names, raw.name),
  };
}

/** Parses one game from an IGDB response; null if IGDB sent something we can't read. */
export function parseIgdbGame(value: unknown): IgdbGame | null {
  const parsed = igdbGameSchema.safeParse(value);
  return parsed.success ? mapIgdbGame(parsed.data) : null;
}
