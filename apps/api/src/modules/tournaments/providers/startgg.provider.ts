import { z } from 'zod';
import type { StartggVideogame } from '@tgh/shared';
import { env } from '../../../config/env';
import { fetchJson, fromEpoch, UpstreamError } from '../../../core/http/upstream';
import type { ProviderState } from '../tournament.model';
import { ProviderNotConfiguredError, type ExternalTournament, type TournamentProviderAdapter } from './provider';

/**
 * start.gg GraphQL API (https://api.start.gg/gql/alpha).
 * Limits: 80 requests / 60 s and at most 1000 objects per request, nested included —
 * hence a lean field set for discovery and a richer one (with standings) per tournament.
 */
const ENDPOINT = 'https://api.start.gg/gql/alpha';
const SERVICE = 'start.gg';
const DISCOVERY_PAGE_SIZE = 25;

const BASE_FIELDS = `
  id name slug startAt endAt registrationClosesAt isRegistrationOpen isOnline
  city countryCode venueName numAttendees state
  images { url type }
`;

// ~12 objects per tournament → 25 per page stays far below the 1000-object cap.
const DISCOVERY_FIELDS = `${BASE_FIELDS}
  events(limit: 3) { name startAt numEntrants videogame { displayName } teamRosterSize { maxPlayers } }
`;

// ~80 objects; used for one tournament at a time.
const DETAIL_FIELDS = `${BASE_FIELDS}
  events(limit: 4) {
    name startAt numEntrants
    videogame { displayName }
    teamRosterSize { maxPlayers }
    standings(query: { page: 1, perPage: 8 }) { nodes { placement entrant { name } } }
  }
`;

const nullableString = z.string().nullish().transform((v) => v ?? null);
const nullableNumber = z.number().nullish().transform((v) => v ?? null);

const eventSchema = z.object({
  name: z.string(),
  startAt: nullableNumber,
  numEntrants: nullableNumber,
  videogame: z.object({ displayName: nullableString }).nullish(),
  teamRosterSize: z.object({ maxPlayers: nullableNumber }).nullish(),
  standings: z
    .object({ nodes: z.array(z.object({ placement: z.number(), entrant: z.object({ name: z.string() }).nullish() })).nullish() })
    .nullish(),
});

export const startggTournamentSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  name: z.string(),
  slug: nullableString,
  startAt: z.number(),
  endAt: nullableNumber,
  registrationClosesAt: nullableNumber,
  isRegistrationOpen: z.boolean().nullish().transform((v) => v ?? null),
  isOnline: z.boolean().nullish().transform((v) => v ?? null),
  city: nullableString,
  countryCode: nullableString,
  venueName: nullableString,
  numAttendees: nullableNumber,
  // Documented as Int carrying ActivityState: CREATED, ACTIVE, COMPLETED (1, 2, 3).
  state: z.union([z.number(), z.string()]).nullish(),
  images: z.array(z.object({ url: nullableString, type: nullableString })).nullish(),
  events: z.array(eventSchema.nullable()).nullish(),
});
type StartggTournament = z.output<typeof startggTournamentSchema>;

function mapState(state: StartggTournament['state']): ProviderState | null {
  if (state === 3 || state === 'COMPLETED') return 'completed';
  if (state === 2 || state === 'ACTIVE') return 'live';
  if (state === 1 || state === 'CREATED') return 'scheduled';
  return null;
}

/** Pure mapping, unit-tested against fixture payloads. */
export function mapStartggTournament(node: StartggTournament): ExternalTournament {
  const events = (node.events ?? []).filter((e): e is NonNullable<typeof e> => Boolean(e));
  const primary = events[0];
  const images = node.images ?? [];
  const image = images.find((i) => i.type === 'profile')?.url ?? images.find((i) => i.url)?.url ?? null;

  return {
    externalId: node.id,
    name: node.name.trim(),
    url: node.slug ? `https://www.start.gg/${node.slug}` : null,
    description: '',
    organizer: null,
    gameName: primary?.videogame?.displayName ?? null,
    imageUrl: image,
    startsAt: fromEpoch(node.startAt)!,
    endsAt: fromEpoch(node.endAt),
    state: mapState(node.state),
    registration: { isOpen: node.isRegistrationOpen, closesAt: fromEpoch(node.registrationClosesAt) },
    online: node.isOnline,
    location:
      node.city || node.countryCode || node.venueName
        ? { city: node.city, countryCode: node.countryCode?.toUpperCase() ?? null, venue: node.venueName }
        : null,
    region: null,
    teamSize: primary ? (primary.teamRosterSize?.maxPlayers ?? 1) : null,
    format: events.length > 1 ? `${events.length} events` : (primary?.name ?? null),
    participants: { count: node.numAttendees, cap: null },
    prize: null,
    events: events.map((event) => ({
      name: event.name,
      gameName: event.videogame?.displayName ?? null,
      startsAt: fromEpoch(event.startAt),
      entrants: event.numEntrants,
      teamSize: event.teamRosterSize?.maxPlayers ?? 1,
      standings: (event.standings?.nodes ?? [])
        .filter((n) => n.entrant?.name)
        .map((n) => ({ placement: n.placement, name: n.entrant!.name })),
    })),
  };
}

const configSchema = z.object({
  videogameId: z.number().int().positive(),
  countryCode: z.string().length(2).nullable().default(null),
});

async function query<T>(document: string, variables: Record<string, unknown>): Promise<T> {
  if (!env.START_GG_TOKEN) throw new ProviderNotConfiguredError(startggProvider);
  const body = (await fetchJson(SERVICE, ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.START_GG_TOKEN}` },
    body: JSON.stringify({ query: document, variables }),
  })) as { data?: T; errors?: Array<{ message?: string }>; success?: boolean; message?: string };

  // Rate-limit and complexity rejections come back as { success: false, message }.
  if (body.success === false) throw new UpstreamError(SERVICE, null, `${SERVICE}: ${body.message ?? 'request rejected'}`);
  if (body.errors?.length) throw new UpstreamError(SERVICE, null, `${SERVICE}: ${body.errors[0]?.message ?? 'query failed'}`);
  if (!body.data) throw new UpstreamError(SERVICE, null, `${SERVICE} returned no data`);
  return body.data;
}

function parseNodes(raw: unknown): ExternalTournament[] {
  const nodes = z.array(z.unknown()).catch([]).parse(raw);
  return nodes.flatMap((node) => {
    const parsed = startggTournamentSchema.safeParse(node);
    return parsed.success ? [mapStartggTournament(parsed.data)] : [];
  });
}

async function fetchBy(args: { id?: string; slug?: string }): Promise<ExternalTournament | null> {
  const data = await query<{ tournament: unknown }>(
    `query One($id: ID, $slug: String) { tournament(id: $id, slug: $slug) { ${DETAIL_FIELDS} } }`,
    args,
  );
  if (!data.tournament) return null;
  const parsed = startggTournamentSchema.safeParse(data.tournament);
  if (!parsed.success) throw new UpstreamError(SERVICE, null, `${SERVICE} returned an unexpected tournament shape`);
  return mapStartggTournament(parsed.data);
}

export const startggProvider: TournamentProviderAdapter & {
  lookupVideogames(name: string): Promise<StartggVideogame[]>;
} = {
  provider: 'startgg',
  label: 'start.gg',
  credentialEnv: 'START_GG_TOKEN',
  configured: () => Boolean(env.START_GG_TOKEN),

  async discover(rawConfig) {
    const config = configSchema.parse(rawConfig);
    const filter: Record<string, unknown> = { upcoming: true, videogameIds: [config.videogameId] };
    if (config.countryCode) filter.countryCode = config.countryCode;
    const data = await query<{ tournaments: { nodes: unknown } | null }>(
      `query Discover($perPage: Int!, $filter: TournamentPageFilter!) {
        tournaments(query: { page: 1, perPage: $perPage, sortBy: "startAt asc", filter: $filter }) {
          nodes { ${DISCOVERY_FIELDS} }
        }
      }`,
      { perPage: DISCOVERY_PAGE_SIZE, filter },
    );
    return parseNodes(data.tournaments?.nodes);
  },

  fetchOne: (externalId) => fetchBy({ id: externalId }),

  matchesUrl: (url) => /(^|\.)(start|smash)\.gg$/i.test(url.hostname) && /^\/tournament\//i.test(url.pathname),

  async fetchFromUrl(url) {
    const name = url.pathname.split('/')[2];
    if (!name) return null;
    // start.gg accepts either the short slug or the "tournament/…" form depending on the tournament.
    return (await fetchBy({ slug: name })) ?? (await fetchBy({ slug: `tournament/${name}` }));
  },

  async lookupVideogames(name) {
    const data = await query<{ videogames: { nodes: unknown } | null }>(
      `query Games($name: String!) { videogames(query: { page: 1, perPage: 10, filter: { name: $name } }) { nodes { id name displayName } } }`,
      { name },
    );
    const nodes = z
      .array(z.object({ id: z.union([z.string(), z.number()]).transform(Number), name: z.string(), displayName: z.string().nullish() }))
      .catch([])
      .parse(data.videogames?.nodes ?? []);
    return nodes.map((n) => ({ id: n.id, name: n.name, displayName: n.displayName ?? n.name }));
  },
};
