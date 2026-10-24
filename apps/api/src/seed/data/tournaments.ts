import type { ExternalTournament } from '../../modules/tournaments/providers/provider';

/**
 * Development fixtures shaped exactly like provider output, stored with
 * provider "sample" so the UI says so and offers no registration link.
 * Real tournaments arrive from start.gg / FACEIT once their credentials are set.
 */
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = Date.now();
const at = (offsetMs: number, hourLocal?: number) => {
  const date = new Date(now + offsetMs);
  if (hourLocal !== undefined) date.setUTCHours(hourLocal - 1, 0, 0, 0); // Tunis is UTC+1
  return date;
};

const SAMPLE_NOTE =
  'Sample tournament for development — not a real event. Connect start.gg or FACEIT in Admin → Tournaments to mirror real brackets.';

export interface SampleTournament {
  game: string;
  tournament: ExternalTournament;
}

const base = {
  url: null,
  description: SAMPLE_NOTE,
  imageUrl: null,
  endsAt: null,
  state: 'scheduled' as const,
  region: null,
  prize: null,
  events: [],
};

export const SAMPLE_TOURNAMENTS: SampleTournament[] = [
  {
    game: 'tekken-8',
    tournament: {
      ...base,
      externalId: 'sample-tunis-tekken-monthly-14',
      name: 'Tunis Tekken Monthly #14',
      organizer: { name: 'Tunis FGC (sample)', url: null },
      gameName: 'TEKKEN 8',
      startsAt: at(9 * DAY, 14),
      registration: { isOpen: true, closesAt: at(7 * DAY, 23) },
      online: false,
      location: { city: 'Tunis', countryCode: 'TN', venue: 'Sample venue, Lac 2' },
      teamSize: 1,
      format: 'Singles · Double elimination',
      participants: { count: 38, cap: 64 },
      prize: '1,200 TND',
    },
  },
  {
    game: 'efootball',
    tournament: {
      ...base,
      externalId: 'sample-sfax-efootball-cup',
      name: 'Sfax eFootball Cup',
      organizer: { name: 'Sfax Esports (sample)', url: null },
      gameName: 'eFootball',
      startsAt: at(4 * DAY, 15),
      registration: { isOpen: true, closesAt: new Date(now + 20 * HOUR) },
      online: false,
      location: { city: 'Sfax', countryCode: 'TN', venue: null },
      teamSize: 1,
      format: '1v1 · Groups then knockout',
      participants: { count: 54, cap: 64 },
      prize: '500 TND',
    },
  },
  {
    game: 'valorant',
    tournament: {
      ...base,
      externalId: 'sample-carthage-valorant-open',
      name: 'Carthage VALORANT Series — Open Qualifier',
      organizer: { name: 'Carthage Series (sample)', url: null },
      gameName: 'VALORANT',
      startsAt: at(12 * DAY, 18),
      registration: { isOpen: true, closesAt: at(10 * DAY, 23) },
      online: true,
      location: null,
      region: 'EU',
      teamSize: 5,
      format: '5v5 · Single elimination, Bo1 → Bo3 final',
      participants: { count: 22, cap: 32 },
    },
  },
  {
    game: 'counter-strike-2',
    tournament: {
      ...base,
      externalId: 'sample-mena-cs2-weekly',
      name: 'MENA CS2 Weekly Cup',
      organizer: null,
      gameName: 'Counter-Strike 2',
      startsAt: at(2 * DAY, 20),
      registration: { isOpen: false, closesAt: at(1 * DAY, 20) },
      online: true,
      location: null,
      region: 'EU',
      teamSize: 5,
      format: '5v5 · Swiss',
      participants: { count: 32, cap: 32 },
    },
  },
  {
    game: 'rocket-league',
    tournament: {
      ...base,
      externalId: 'sample-rl-2v2-night',
      name: 'Rocket League 2v2 Night',
      organizer: null,
      gameName: 'Rocket League',
      startsAt: new Date(now - HOUR),
      endsAt: new Date(now + 3 * HOUR),
      state: 'live',
      registration: { isOpen: false, closesAt: new Date(now - 2 * HOUR) },
      online: true,
      location: null,
      teamSize: 2,
      format: '2v2 · Double elimination',
      participants: { count: 24, cap: 32 },
    },
  },
  {
    game: 'league-of-legends',
    tournament: {
      ...base,
      externalId: 'sample-lol-clash-opener',
      name: 'League of Legends Clash TN — Season Opener',
      organizer: { name: 'Rift TN (sample)', url: null },
      gameName: 'League of Legends',
      startsAt: new Date(now - 6 * DAY),
      endsAt: new Date(now - 5 * DAY),
      state: 'completed',
      registration: { isOpen: false, closesAt: new Date(now - 7 * DAY) },
      online: true,
      location: { city: null, countryCode: 'TN', venue: null },
      teamSize: 5,
      format: '5v5 · Single elimination',
      participants: { count: 16, cap: 16 },
      events: [
        {
          name: 'Main bracket',
          gameName: 'League of Legends',
          startsAt: new Date(now - 6 * DAY),
          entrants: 16,
          teamSize: 5,
          standings: [
            { placement: 1, name: 'Medina Wolves (sample)' },
            { placement: 2, name: 'Sahel Five (sample)' },
            { placement: 3, name: 'Kerkennah Tide (sample)' },
            { placement: 4, name: 'Atlas Rift (sample)' },
          ],
        },
      ],
    },
  },
  {
    game: 'marvel-rivals',
    tournament: {
      ...base,
      externalId: 'sample-monastir-rivals-showdown',
      name: 'Monastir Marvel Rivals Showdown',
      organizer: { name: 'Sahel Gaming (sample)', url: null },
      gameName: 'Marvel Rivals',
      startsAt: at(20 * DAY, 13),
      registration: { isOpen: null, closesAt: null },
      online: false,
      location: { city: 'Monastir', countryCode: 'TN', venue: null },
      teamSize: 6,
      format: '6v6 · LAN finals',
      participants: { count: null, cap: 16 },
    },
  },
  {
    game: 'ea-sports-fc-25',
    tournament: {
      ...base,
      externalId: 'sample-fc25-pro-clubs',
      name: 'FC 25 Pro Clubs Invitational',
      organizer: null,
      gameName: 'EA SPORTS FC 25',
      startsAt: at(6 * DAY, 21),
      registration: { isOpen: true, closesAt: at(5 * DAY, 21) },
      online: true,
      location: null,
      teamSize: 11,
      format: 'Pro Clubs · League then playoffs',
      participants: { count: 9, cap: 16 },
    },
  },
];
