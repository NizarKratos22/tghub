import type { DiscoveryProvider } from '@tgh/shared';
import type { ProviderState, TournamentEventDoc } from '../tournament.model';

/** Provider-agnostic shape every adapter returns; sync maps it onto TournamentDoc. */
export interface ExternalTournament {
  externalId: string;
  name: string;
  url: string | null;
  description: string;
  organizer: { name: string; url: string | null } | null;
  gameName: string | null;
  imageUrl: string | null;
  startsAt: Date;
  endsAt: Date | null;
  state: ProviderState | null;
  registration: { isOpen: boolean | null; closesAt: Date | null };
  online: boolean | null;
  location: { city: string | null; countryCode: string | null; venue: string | null } | null;
  region: string | null;
  teamSize: number | null;
  format: string | null;
  participants: { count: number | null; cap: number | null };
  prize: string | null;
  events: TournamentEventDoc[];
}

/**
 * One adapter per platform. Adding Challonge or Toornament later means one
 * more implementation of this interface — sync, storage and the web don't change.
 */
export interface TournamentProviderAdapter {
  provider: DiscoveryProvider;
  label: string;
  /** Env var holding the credential, shown to admins when it's missing. */
  credentialEnv: string;
  configured(): boolean;
  /** Upcoming tournaments for a source's (provider-specific) config. */
  discover(config: unknown): Promise<ExternalTournament[]>;
  /** Fresh copy of one tournament, or null if the provider no longer has it. */
  fetchOne(externalId: string): Promise<ExternalTournament | null>;
  /** Whether a public page URL belongs to this platform. */
  matchesUrl(url: URL): boolean;
  fetchFromUrl(url: URL): Promise<ExternalTournament | null>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(adapter: Pick<TournamentProviderAdapter, 'label' | 'credentialEnv'>) {
    super(`${adapter.label} is not connected — set ${adapter.credentialEnv} on the API server`);
    this.name = 'ProviderNotConfiguredError';
  }
}

/** Collapses provider descriptions (markdown/HTML) into plain text for our pages. */
export function plainText(raw: string | null | undefined, max = 1500): string {
  if (!raw) return '';
  const text = raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_`#>]+/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
