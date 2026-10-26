import { TOURNAMENT_PROVIDER_META, type TournamentSummary } from '@tgh/shared';
import { fill } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Format } from '@/lib/format';

/** "1v1", "5v5"; Pro Clubs and other big squads read better as "11-player teams". */
export function teamSizeLabel(size: number | null, t: Dictionary, format: Format): string | null {
  if (!size) return null;
  return format.fill(size <= 6 ? t.tournaments.teamSize : t.tournaments.bigTeams, { size });
}

export function whereLabel(tournament: Pick<TournamentSummary, 'online' | 'location' | 'region' | 'isLocal'>, t: Dictionary): string {
  if (tournament.online) return tournament.region ? fill(t.tournaments.onlineRegion, { region: tournament.region }) : t.tournaments.online;
  const city = tournament.location?.city;
  const venue = tournament.location?.venue;
  if (city && venue) return `${city} · ${venue}`;
  if (city) return city;
  return tournament.isLocal ? t.tournaments.tunisia : t.tournaments.inPerson;
}

export function entrantsLabel(participants: TournamentSummary['participants'], t: Dictionary, format: Format): string | null {
  if (participants.count !== null && participants.cap !== null) return fill(t.tournaments.entrantsOfCap, { count: participants.count, cap: participants.cap });
  if (participants.count !== null) return format.fill(t.tournaments.entrantsCount, { count: participants.count });
  if (participants.cap !== null) return format.fill(t.tournaments.slots, { count: participants.cap });
  return null;
}

export const providerLabel = (provider: TournamentSummary['provider'], t: Dictionary) =>
  provider === 'sample' ? t.tournaments.sampleProvider : TOURNAMENT_PROVIDER_META[provider].label;

/** Call to action for the organizer's page — the only place sign-up ever happens. */
export function externalCta(tournament: Pick<TournamentSummary, 'url' | 'provider' | 'status'>, t: Dictionary): { href: string; label: string } | null {
  if (!tournament.url) return null;
  const site = providerLabel(tournament.provider, t);
  if (tournament.status === 'registration_open') return { href: tournament.url, label: fill(t.tournaments.signUpOn, { site }) };
  if (tournament.status === 'completed') return { href: tournament.url, label: fill(t.tournaments.resultsOn, { site }) };
  return { href: tournament.url, label: fill(t.tournaments.viewOn, { site }) };
}
