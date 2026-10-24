import { TOURNAMENT_PROVIDER_META, type TournamentSummary } from '@tgh/shared';

/** "1v1", "5v5"; Pro Clubs and other big squads read better as "11-player teams". */
export function teamSizeLabel(size: number | null): string | null {
  if (!size) return null;
  return size <= 6 ? `${size}v${size}` : `${size}-player teams`;
}

export function whereLabel(tournament: Pick<TournamentSummary, 'online' | 'location' | 'region' | 'isLocal'>): string {
  if (tournament.online) return tournament.region ? `Online · ${tournament.region}` : 'Online';
  const city = tournament.location?.city;
  const venue = tournament.location?.venue;
  if (city && venue) return `${city} · ${venue}`;
  if (city) return city;
  return tournament.isLocal ? 'Tunisia' : 'In person';
}

export function entrantsLabel(participants: TournamentSummary['participants']): string | null {
  if (participants.count !== null && participants.cap !== null) return `${participants.count}/${participants.cap} entrants`;
  if (participants.count !== null) return `${participants.count} entrants`;
  if (participants.cap !== null) return `${participants.cap} slots`;
  return null;
}

export const providerLabel = (provider: TournamentSummary['provider']) => TOURNAMENT_PROVIDER_META[provider].label;

/** Call to action for the organizer's page — the only place sign-up ever happens. */
export function externalCta(tournament: Pick<TournamentSummary, 'url' | 'provider' | 'status'>): { href: string; label: string } | null {
  if (!tournament.url) return null;
  const site = providerLabel(tournament.provider);
  if (tournament.status === 'registration_open') return { href: tournament.url, label: `Sign up on ${site}` };
  if (tournament.status === 'completed') return { href: tournament.url, label: `Results on ${site}` };
  return { href: tournament.url, label: `View on ${site}` };
}
