import type {
  AdminTournament,
  GameRef,
  TournamentDetail,
  TournamentSource as TournamentSourceDto,
  TournamentSummary,
} from '@tgh/shared';
import { iso } from '../../core/http/utils';
import { healthOf } from '../../core/ingest/source-health';
import { gameRefMap } from '../games/games.service';
import type { TournamentDoc, TournamentSourceDoc } from './tournament.model';
import { deriveStatus } from './tournament.status';

const gameFrom = (games: Map<string, GameRef>, id: unknown) => (id ? (games.get(String(id)) ?? null) : null);

export function toTournamentSummary(doc: TournamentDoc, games: Map<string, GameRef>, now = new Date()): TournamentSummary {
  return {
    id: String(doc._id),
    slug: doc.slug,
    name: doc.name,
    provider: doc.provider,
    url: doc.url,
    game: gameFrom(games, doc.gameId),
    gameName: doc.gameName,
    imageUrl: doc.imageUrl,
    startsAt: doc.startsAt.toISOString(),
    endsAt: iso(doc.endsAt),
    status: deriveStatus(doc, now),
    online: doc.online,
    location: doc.location ?? null,
    isLocal: doc.isLocal,
    region: doc.region,
    teamSize: doc.teamSize,
    format: doc.format,
    participants: { count: doc.participants?.count ?? null, cap: doc.participants?.cap ?? null },
    registration: { isOpen: doc.registration?.isOpen ?? null, closesAt: iso(doc.registration?.closesAt) },
    prize: doc.prize,
    featured: doc.featured,
  };
}

export async function toTournamentSummaries(docs: TournamentDoc[]): Promise<TournamentSummary[]> {
  const games = await gameRefMap(docs.map((doc) => doc.gameId));
  const now = new Date();
  return docs.map((doc) => toTournamentSummary(doc, games, now));
}

export function toTournamentDetail(doc: TournamentDoc, games: Map<string, GameRef>, followers: number): TournamentDetail {
  return {
    ...toTournamentSummary(doc, games),
    description: doc.description,
    organizer: doc.organizer ?? null,
    events: doc.events.map((event) => ({
      name: event.name,
      gameName: event.gameName,
      startsAt: iso(event.startsAt),
      entrants: event.entrants,
      teamSize: event.teamSize,
      standings: event.standings,
    })),
    followers,
    lastSyncedAt: iso(doc.lastSyncedAt),
  };
}

export function toAdminTournament(doc: TournamentDoc, games: Map<string, GameRef>, sourceNames: Map<string, string>): AdminTournament {
  return {
    ...toTournamentSummary(doc, games),
    hidden: doc.hidden,
    sourceName: doc.sourceId ? (sourceNames.get(String(doc.sourceId)) ?? null) : null,
    lastSyncedAt: iso(doc.lastSyncedAt),
  };
}

export function toTournamentSourceDto(doc: TournamentSourceDoc, games: Map<string, GameRef>): TournamentSourceDto {
  return {
    id: String(doc._id),
    name: doc.name,
    provider: doc.provider,
    config: doc.config,
    game: gameFrom(games, doc.gameId),
    enabled: doc.enabled,
    intervalMinutes: doc.intervalMinutes,
    health: healthOf(doc),
    lastRunAt: iso(doc.lastRunAt),
    lastSuccessAt: iso(doc.lastSuccessAt),
    lastError: doc.lastError,
    consecutiveFailures: doc.consecutiveFailures,
    itemsIngested: doc.itemsIngested,
  };
}
