import { GAME_MODES, type GameDetail, type GameMode, type GameRef, type GameSummary, type RequirementTier } from '@tgh/shared';
import { igdbImage } from '../igdb/igdb.mapper';
import type { GameDoc, RequirementTierDoc } from './game.model';

export const GAME_REF_FIELDS = '_id slug title monogram accent';
export const GAME_SUMMARY_FIELDS =
  '_id slug title monogram accent tagline genres platforms freeToPlay coverUrl igdb.coverId developer releaseDate popularity requirements';

type RefSource = Pick<GameDoc, '_id' | 'slug' | 'title' | 'monogram' | 'accent'>;
type SummarySource = RefSource &
  Pick<
    GameDoc,
    'tagline' | 'genres' | 'platforms' | 'freeToPlay' | 'coverUrl' | 'developer' | 'releaseDate' | 'popularity' | 'requirements'
  > & { igdb?: Partial<GameDoc['igdb']> };

/** IGDB's cover when the game is linked, else a cover set by hand. */
const coverOf = (game: SummarySource) => (game.igdb?.coverId ? igdbImage(game.igdb.coverId, 'cover_big_2x') : game.coverUrl);

/** Entries from before IGDB may still hold old modes ("competitive"); only IGDB's are shown. */
const knownModes = (modes: string[]): GameMode[] => modes.filter((mode): mode is GameMode => (GAME_MODES as readonly string[]).includes(mode));

export function toGameRef(game: RefSource): GameRef {
  return {
    id: String(game._id),
    slug: game.slug,
    title: game.title,
    monogram: game.monogram,
    accent: game.accent,
  };
}

export function toGameSummary(game: SummarySource): GameSummary {
  return {
    ...toGameRef(game),
    tagline: game.tagline,
    genres: game.genres,
    platforms: game.platforms,
    freeToPlay: game.freeToPlay,
    coverUrl: coverOf(game),
    developer: game.developer,
    releaseYear: game.releaseDate ? game.releaseDate.getUTCFullYear() : null,
    popularity: game.popularity,
    hasPcRequirements: Boolean(game.requirements?.minimum || game.requirements?.recommended),
  };
}

function toTier(tier: RequirementTierDoc | null | undefined): RequirementTier | null {
  if (!tier) return null;
  return {
    cpuLabel: tier.cpuLabel,
    gpuLabel: tier.gpuLabel,
    cpuScore: tier.cpuScore ?? null,
    gpuScore: tier.gpuScore ?? null,
    ramGb: tier.ramGb,
    vramGb: tier.vramGb ?? null,
    storageGb: tier.storageGb ?? null,
    os: tier.os ?? null,
  };
}

export function toGameDetail(game: GameDoc): GameDetail {
  const igdb = game.igdb;
  const wide = igdb?.artworkIds?.[0] ?? igdb?.screenshotIds?.[0] ?? null;
  return {
    ...toGameSummary(game),
    description: game.description,
    publisher: game.publisher,
    modes: knownModes(game.modes),
    languages: game.languages,
    links: { official: game.links?.official ?? null, store: game.links?.store ?? null },
    artworkUrl: wide ? igdbImage(wide, '1080p') : null,
    screenshots: (igdb?.screenshotIds ?? []).slice(0, 8).map((id) => ({ thumbUrl: igdbImage(id, 'screenshot_big'), url: igdbImage(id, '1080p') })),
    videos: (igdb?.videoIds ?? []).slice(0, 3),
    rating: igdb?.rating !== null && igdb?.rating !== undefined ? { score: igdb.rating, count: igdb.ratingCount } : null,
    igdbUrl: igdb?.id ? igdb.url : null,
    requirements: {
      minimum: toTier(game.requirements?.minimum),
      recommended: toTier(game.requirements?.recommended),
      source: game.requirements?.source ?? null,
    },
  };
}
