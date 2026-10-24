import type { GameDetail, GameRef, GameSummary, RequirementTier } from '@tgh/shared';
import type { GameDoc, RequirementTierDoc } from './game.model';

export const GAME_REF_FIELDS = '_id slug title monogram accent';
export const GAME_SUMMARY_FIELDS =
  '_id slug title monogram accent tagline genres platforms freeToPlay coverUrl developer releaseDate popularity requirements';

type RefSource = Pick<GameDoc, '_id' | 'slug' | 'title' | 'monogram' | 'accent'>;
type SummarySource = RefSource &
  Pick<
    GameDoc,
    'tagline' | 'genres' | 'platforms' | 'freeToPlay' | 'coverUrl' | 'developer' | 'releaseDate' | 'popularity' | 'requirements'
  >;

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
    coverUrl: game.coverUrl,
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
  return {
    ...toGameSummary(game),
    description: game.description,
    publisher: game.publisher,
    modes: game.modes,
    languages: game.languages,
    links: { official: game.links?.official ?? null, store: game.links?.store ?? null },
    requirements: {
      minimum: toTier(game.requirements?.minimum),
      recommended: toTier(game.requirements?.recommended),
      source: game.requirements?.source ?? null,
    },
  };
}
