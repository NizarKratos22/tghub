import { z } from 'zod';
import { env } from '../../../config/env';
import { fetchJson, fromEpoch, UpstreamError } from '../../../core/http/upstream';
import type { ProviderState } from '../tournament.model';
import { plainText, ProviderNotConfiguredError, type ExternalTournament, type TournamentProviderAdapter } from './provider';

/**
 * FACEIT Data API v4 — championships (FACEIT's tournaments).
 * GET /championships caps `limit` at 10; timestamps are int64 with an
 * undocumented unit, so they go through fromEpoch().
 */
const BASE = 'https://open.faceit.com/data/v4';
const SERVICE = 'FACEIT';
const DISCOVERY_PAGES = 2;

const optionalString = z.string().nullish().transform((v) => v ?? null);
const optionalNumber = z.number().nullish().transform((v) => v ?? null);

export const faceitChampionshipSchema = z.object({
  championship_id: z.string().nullish(),
  id: z.string().nullish(),
  name: z.string(),
  description: optionalString,
  game_id: optionalString,
  game_data: z.object({ long_label: optionalString, short_label: optionalString }).nullish(),
  region: optionalString,
  status: optionalString,
  faceit_url: optionalString,
  cover_image: optionalString,
  background_image: optionalString,
  avatar: optionalString,
  championship_start: optionalNumber,
  subscription_start: optionalNumber,
  subscription_end: optionalNumber,
  slots: optionalNumber,
  current_subscriptions: optionalNumber,
  full: z.boolean().nullish(),
  prizes: z.array(z.object({ faceit_points: optionalNumber, rank: optionalNumber })).nullish(),
  organizer_data: z.object({ name: optionalString, faceit_url: optionalString }).nullish(),
});
type FaceitChampionship = z.output<typeof faceitChampionshipSchema>;

const resultsSchema = z.object({
  items: z
    .array(
      z.object({
        bounds: z.object({ left: z.number() }).nullish(),
        placements: z.array(z.object({ name: z.string() })).nullish(),
      }),
    )
    .nullish(),
});

function mapState(status: string | null): ProviderState | null {
  const value = status?.toLowerCase();
  if (!value) return null;
  if (value === 'finished') return 'completed';
  if (value === 'cancelled' || value === 'canceled') return 'cancelled';
  if (value === 'started' || value === 'ongoing') return 'live';
  return 'scheduled';
}

function registrationOpen(championship: FaceitChampionship, state: ProviderState | null): boolean | null {
  if (state === 'completed' || state === 'cancelled' || state === 'live' || championship.full) return false;
  if (championship.status?.toLowerCase() === 'join') return true;
  return null;
}

export function mapFaceitChampionship(
  championship: FaceitChampionship,
  standings: Array<{ placement: number; name: string }> = [],
): ExternalTournament | null {
  const externalId = championship.championship_id ?? championship.id;
  const startsAt = fromEpoch(championship.championship_start);
  if (!externalId || !startsAt) return null;

  const state = mapState(championship.status);
  const points = (championship.prizes ?? []).reduce((sum, prize) => sum + (prize.faceit_points ?? 0), 0);
  const gameName = championship.game_data?.long_label ?? championship.game_id;

  return {
    externalId,
    name: championship.name.trim(),
    url: championship.faceit_url
      ? championship.faceit_url.replace('{lang}', 'en')
      : `https://www.faceit.com/en/championship/${externalId}`,
    description: plainText(championship.description),
    organizer: championship.organizer_data?.name
      ? { name: championship.organizer_data.name, url: championship.organizer_data.faceit_url?.replace('{lang}', 'en') ?? null }
      : null,
    gameName,
    imageUrl: championship.cover_image ?? championship.background_image ?? championship.avatar,
    startsAt,
    endsAt: null,
    state,
    registration: { isOpen: registrationOpen(championship, state), closesAt: fromEpoch(championship.subscription_end) },
    online: true,
    location: null,
    region: championship.region,
    teamSize: null,
    format: null,
    participants: { count: championship.current_subscriptions, cap: championship.slots },
    prize: points > 0 ? `${points.toLocaleString('en-US')} FACEIT points` : null,
    events: standings.length > 0 ? [{ name: 'Final standings', gameName, startsAt, entrants: championship.current_subscriptions, teamSize: null, standings }] : [],
  };
}

const configSchema = z.object({
  game: z.string().min(2),
  region: z.string().nullable().default(null),
});

async function get(path: string, params: Record<string, string | number> = {}): Promise<unknown> {
  if (!env.FACEIT_API_KEY) throw new ProviderNotConfiguredError(faceitProvider);
  const url = new URL(`${BASE}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  return fetchJson(SERVICE, url, { headers: { authorization: `Bearer ${env.FACEIT_API_KEY}`, accept: 'application/json' } });
}

async function standingsFor(championshipId: string): Promise<Array<{ placement: number; name: string }>> {
  const parsed = resultsSchema.safeParse(await get(`/championships/${championshipId}/results`, { offset: 0, limit: 8 }));
  if (!parsed.success) return [];
  return (parsed.data.items ?? [])
    .flatMap((group) => (group.placements ?? []).map((p) => ({ placement: group.bounds?.left ?? 0, name: p.name })))
    .filter((s) => s.placement > 0)
    .sort((a, b) => a.placement - b.placement)
    .slice(0, 8);
}

async function fetchChampionship(id: string): Promise<ExternalTournament | null> {
  let raw: unknown;
  try {
    raw = await get(`/championships/${encodeURIComponent(id)}`, { expanded: 'organizer,game' });
  } catch (error) {
    if (error instanceof UpstreamError && error.status === 404) return null;
    throw error;
  }
  const parsed = faceitChampionshipSchema.safeParse(raw);
  if (!parsed.success) throw new UpstreamError(SERVICE, null, `${SERVICE} returned an unexpected championship shape`);
  const finished = mapState(parsed.data.status) === 'completed';
  return mapFaceitChampionship(parsed.data, finished ? await standingsFor(id).catch(() => []) : []);
}

export const faceitProvider: TournamentProviderAdapter = {
  provider: 'faceit',
  label: 'FACEIT',
  credentialEnv: 'FACEIT_API_KEY',
  configured: () => Boolean(env.FACEIT_API_KEY),

  async discover(rawConfig) {
    const config = configSchema.parse(rawConfig);
    const results: ExternalTournament[] = [];
    for (let page = 0; page < DISCOVERY_PAGES; page += 1) {
      const body = z
        .object({ items: z.array(z.unknown()).nullish() })
        .parse(await get('/championships', { game: config.game, type: 'upcoming', offset: page * 10, limit: 10 }));
      const items = body.items ?? [];
      for (const item of items) {
        const parsed = faceitChampionshipSchema.safeParse(item);
        if (!parsed.success) continue;
        if (config.region && parsed.data.region?.toLowerCase() !== config.region.toLowerCase()) continue;
        const mapped = mapFaceitChampionship(parsed.data);
        if (mapped) results.push(mapped);
      }
      if (items.length < 10) break;
    }
    return results;
  },

  fetchOne: fetchChampionship,

  matchesUrl: (url) => /(^|\.)faceit\.com$/i.test(url.hostname) && /\/championship\//i.test(url.pathname),

  async fetchFromUrl(url) {
    const id = url.pathname.match(/\/championship\/([0-9a-f-]{36})/i)?.[1];
    return id ? fetchChampionship(id) : null;
  },
};
