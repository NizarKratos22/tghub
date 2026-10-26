import { model, Schema, type Types } from 'mongoose';
import { GAME_MODES, GENRES, PLATFORMS, type GameMode, type Genre, type Platform } from '@tgh/shared';

export interface RequirementTierDoc {
  cpuLabel: string;
  gpuLabel: string;
  /** Relative benchmark index of the weakest CPU the developer lists. */
  cpuScore: number | null;
  gpuScore: number | null;
  ramGb: number;
  vramGb: number | null;
  storageGb: number | null;
  os: string | null;
}

/** What the catalogue keeps from IGDB besides the fields it fills in directly. */
export interface GameIgdbDoc {
  id: number | null;
  url: string | null;
  coverId: string | null;
  artworkIds: string[];
  screenshotIds: string[];
  videoIds: string[];
  rating: number | null;
  ratingCount: number;
  /** Other names from IGDB, lower-cased, matched by search like aliases. */
  altNames: string[];
  syncedAt: Date | null;
}

export interface GameDoc {
  _id: Types.ObjectId;
  slug: string;
  title: string;
  titleLower: string;
  monogram: string;
  tagline: string;
  description: string;
  genres: Genre[];
  platforms: Platform[];
  modes: GameMode[];
  developer: string;
  publisher: string;
  releaseDate: Date | null;
  freeToPlay: boolean;
  accent: string;
  coverUrl: string | null;
  /** Short names players actually type: "cs2", "lol", "r6". */
  aliases: string[];
  tags: string[];
  languages: string[];
  steamAppId: number | null;
  links: { official: string | null; store: string | null };
  requirements: {
    minimum: RequirementTierDoc | null;
    recommended: RequirementTierDoc | null;
    source: string | null;
  };
  popularity: number;
  featured: boolean;
  status: 'published' | 'draft';
  /**
   * IGDB owns the facts (description, dates, companies, platforms, modes, art);
   * TG Hub owns the title, slug, monogram, accent, tagline, genres, nicknames,
   * requirements and ranking.
   */
  igdb: GameIgdbDoc;
  createdAt: Date;
  updatedAt: Date;
}

const tierSchema = new Schema<RequirementTierDoc>(
  {
    cpuLabel: { type: String, required: true },
    gpuLabel: { type: String, required: true },
    cpuScore: { type: Number, default: null },
    gpuScore: { type: Number, default: null },
    ramGb: { type: Number, required: true },
    vramGb: { type: Number, default: null },
    storageGb: { type: Number, default: null },
    os: { type: String, default: null },
  },
  { _id: false },
);

const gameSchema = new Schema<GameDoc>(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    titleLower: { type: String, required: true },
    monogram: { type: String, required: true },
    tagline: { type: String, default: '' },
    description: { type: String, default: '' },
    genres: { type: [String], enum: GENRES, default: [] },
    platforms: { type: [String], enum: PLATFORMS, default: [] },
    modes: { type: [String], enum: GAME_MODES, default: [] },
    developer: { type: String, default: '' },
    publisher: { type: String, default: '' },
    releaseDate: { type: Date, default: null },
    freeToPlay: { type: Boolean, default: false },
    accent: { type: String, default: '#e10600' },
    coverUrl: { type: String, default: null },
    aliases: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    languages: { type: [String], default: [] },
    steamAppId: { type: Number, default: null },
    links: {
      official: { type: String, default: null },
      store: { type: String, default: null },
    },
    requirements: {
      minimum: { type: tierSchema, default: null },
      recommended: { type: tierSchema, default: null },
      source: { type: String, default: null },
    },
    popularity: { type: Number, default: 50 },
    featured: { type: Boolean, default: false },
    status: { type: String, enum: ['published', 'draft'], default: 'published' },
    igdb: {
      id: { type: Number, default: null },
      url: { type: String, default: null },
      coverId: { type: String, default: null },
      artworkIds: { type: [String], default: [] },
      screenshotIds: { type: [String], default: [] },
      videoIds: { type: [String], default: [] },
      rating: { type: Number, default: null },
      ratingCount: { type: Number, default: 0 },
      altNames: { type: [String], default: [] },
      syncedAt: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

gameSchema.index({ status: 1, popularity: -1 });
gameSchema.index({ titleLower: 1 });
gameSchema.index({ aliases: 1 });
gameSchema.index({ 'igdb.altNames': 1 });
// One catalogue entry per IGDB game.
gameSchema.index({ 'igdb.id': 1 }, { unique: true, partialFilterExpression: { 'igdb.id': { $type: 'number' } } });
gameSchema.index({ genres: 1 });
gameSchema.index({ platforms: 1 });
gameSchema.index({ 'requirements.minimum.gpuScore': 1 });

export const Game = model<GameDoc>('Game', gameSchema);
