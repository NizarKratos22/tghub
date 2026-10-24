import { model, Schema, type Types } from 'mongoose';
import { DISCOVERY_PROVIDERS, TOURNAMENT_PROVIDERS, type DiscoveryProvider, type TournamentProvider } from '@tgh/shared';
import type { SourceHealthFields } from '../../core/ingest/source-health';

/** Lifecycle as the provider reports it. TG Hub derives the display status from this plus dates. */
export const PROVIDER_STATES = ['scheduled', 'live', 'completed', 'cancelled'] as const;
export type ProviderState = (typeof PROVIDER_STATES)[number];
/** States after which nothing about a tournament changes. */
export const FINAL_STATES: ProviderState[] = ['completed', 'cancelled'];

export interface TournamentEventDoc {
  name: string;
  gameName: string | null;
  startsAt: Date | null;
  entrants: number | null;
  teamSize: number | null;
  standings: Array<{ placement: number; name: string }>;
}

/**
 * A read-only mirror of a tournament hosted on start.gg / FACEIT. Everything
 * except the moderation fields (hidden, featured, gameId) is overwritten on sync.
 */
export interface TournamentDoc {
  _id: Types.ObjectId;
  provider: TournamentProvider;
  externalId: string;
  slug: string;
  name: string;
  nameLower: string;
  url: string | null;
  description: string;
  organizer: { name: string; url: string | null } | null;
  gameId: Types.ObjectId | null;
  gameName: string | null;
  imageUrl: string | null;
  startsAt: Date;
  endsAt: Date | null;
  providerState: ProviderState | null;
  registration: { isOpen: boolean | null; closesAt: Date | null };
  online: boolean | null;
  location: { city: string | null; countryCode: string | null; venue: string | null } | null;
  isLocal: boolean;
  region: string | null;
  teamSize: number | null;
  format: string | null;
  participants: { count: number | null; cap: number | null };
  prize: string | null;
  events: TournamentEventDoc[];
  sourceId: Types.ObjectId | null;
  hidden: boolean;
  featured: boolean;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<TournamentEventDoc>(
  {
    name: { type: String, required: true },
    gameName: { type: String, default: null },
    startsAt: { type: Date, default: null },
    entrants: { type: Number, default: null },
    teamSize: { type: Number, default: null },
    standings: [{ placement: Number, name: String, _id: false }],
  },
  { _id: false },
);

const tournamentSchema = new Schema<TournamentDoc>(
  {
    provider: { type: String, enum: TOURNAMENT_PROVIDERS, required: true },
    externalId: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    nameLower: { type: String, required: true },
    url: { type: String, default: null },
    description: { type: String, default: '' },
    organizer: { type: new Schema({ name: String, url: String }, { _id: false }), default: null },
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', default: null },
    gameName: { type: String, default: null },
    imageUrl: { type: String, default: null },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, default: null },
    providerState: { type: String, default: null },
    registration: {
      isOpen: { type: Boolean, default: null },
      closesAt: { type: Date, default: null },
    },
    online: { type: Boolean, default: null },
    location: { type: new Schema({ city: String, countryCode: String, venue: String }, { _id: false }), default: null },
    isLocal: { type: Boolean, default: false },
    region: { type: String, default: null },
    teamSize: { type: Number, default: null },
    format: { type: String, default: null },
    participants: {
      count: { type: Number, default: null },
      cap: { type: Number, default: null },
    },
    prize: { type: String, default: null },
    events: { type: [eventSchema], default: [] },
    sourceId: { type: Schema.Types.ObjectId, ref: 'TournamentSource', default: null },
    hidden: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
    lastSyncedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

tournamentSchema.index({ provider: 1, externalId: 1 }, { unique: true });
tournamentSchema.index({ hidden: 1, startsAt: 1 });
tournamentSchema.index({ gameId: 1, startsAt: 1 });
tournamentSchema.index({ isLocal: 1, startsAt: 1 });
tournamentSchema.index({ nameLower: 1 });
tournamentSchema.index({ 'registration.closesAt': 1 });
tournamentSchema.index({ providerState: 1, lastSyncedAt: 1 });

export const Tournament = model<TournamentDoc>('Tournament', tournamentSchema);

/* ── Discovery feeds: "Tekken 8 events in Tunisia on start.gg", "FACEIT CS2 EU championships". ── */

export interface TournamentSourceDoc extends SourceHealthFields {
  _id: Types.ObjectId;
  name: string;
  provider: DiscoveryProvider;
  /** Provider-specific, validated by the shared schema and parsed again by the adapter. */
  config: Record<string, unknown>;
  gameId: Types.ObjectId | null;
  itemsIngested: number;
  createdAt: Date;
  updatedAt: Date;
}

const tournamentSourceSchema = new Schema<TournamentSourceDoc>(
  {
    name: { type: String, required: true },
    provider: { type: String, enum: DISCOVERY_PROVIDERS, required: true },
    config: { type: Schema.Types.Mixed, required: true },
    gameId: { type: Schema.Types.ObjectId, ref: 'Game', default: null },
    enabled: { type: Boolean, default: true },
    intervalMinutes: { type: Number, default: 180 },
    lastRunAt: { type: Date, default: null },
    lastSuccessAt: { type: Date, default: null },
    lastError: { type: String, default: null },
    consecutiveFailures: { type: Number, default: 0 },
    itemsIngested: { type: Number, default: 0 },
  },
  { timestamps: true, minimize: false },
);

export const TournamentSource = model<TournamentSourceDoc>('TournamentSource', tournamentSourceSchema, 'tournament_sources');

/* ── Follows double as reminder subscriptions. ── */

export interface TournamentFollowDoc {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tournamentId: Types.ObjectId;
  createdAt: Date;
}

const tournamentFollowSchema = new Schema<TournamentFollowDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tournamentId: { type: Schema.Types.ObjectId, ref: 'Tournament', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
tournamentFollowSchema.index({ userId: 1, tournamentId: 1 }, { unique: true });
tournamentFollowSchema.index({ tournamentId: 1 });

export const TournamentFollow = model<TournamentFollowDoc>('TournamentFollow', tournamentFollowSchema, 'tournament_follows');
