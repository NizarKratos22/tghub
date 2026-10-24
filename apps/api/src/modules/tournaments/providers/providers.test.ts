import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tournamentSlug } from '../tournaments.sync';
import { faceitChampionshipSchema, faceitProvider, mapFaceitChampionship } from './faceit.provider';
import { mapStartggTournament, startggProvider, startggTournamentSchema } from './startgg.provider';

/* Fixtures follow the documented field names (start.gg schema reference, FACEIT Data API v4 swagger). */

describe('start.gg mapping', () => {
  const node = startggTournamentSchema.parse({
    id: 712345,
    name: ' Tunis Tekken Monthly #15 ',
    slug: 'tournament/tunis-tekken-monthly-15',
    startAt: 1_793_000_000,
    endAt: 1_793_030_000,
    registrationClosesAt: 1_792_900_000,
    isRegistrationOpen: true,
    isOnline: false,
    city: 'Tunis',
    countryCode: 'tn',
    venueName: 'Lac 2',
    numAttendees: 41,
    state: 1,
    images: [
      { url: 'https://images.start.gg/banner.png', type: 'banner' },
      { url: 'https://images.start.gg/profile.png', type: 'profile' },
    ],
    events: [
      {
        name: 'TEKKEN 8 Singles',
        startAt: 1_793_000_000,
        numEntrants: 41,
        videogame: { displayName: 'TEKKEN 8' },
        teamRosterSize: null,
        standings: { nodes: [{ placement: 1, entrant: { name: 'kaiser' } }, { placement: 2, entrant: null }] },
      },
      null,
    ],
  });

  it('maps core fields and seconds timestamps', () => {
    const t = mapStartggTournament(node);
    assert.equal(t.externalId, '712345');
    assert.equal(t.name, 'Tunis Tekken Monthly #15');
    assert.equal(t.url, 'https://www.start.gg/tournament/tunis-tekken-monthly-15');
    assert.equal(t.startsAt.toISOString(), new Date(1_793_000_000 * 1000).toISOString());
    assert.equal(t.state, 'scheduled');
    assert.deepEqual(t.registration, { isOpen: true, closesAt: new Date(1_792_900_000 * 1000) });
  });

  it('normalises location, game, team size and image', () => {
    const t = mapStartggTournament(node);
    assert.equal(t.location?.countryCode, 'TN');
    assert.equal(t.gameName, 'TEKKEN 8');
    assert.equal(t.teamSize, 1, 'no roster size means a singles event');
    assert.equal(t.imageUrl, 'https://images.start.gg/profile.png');
  });

  it('keeps only standings with an entrant name', () => {
    assert.deepEqual(mapStartggTournament(node).events[0]?.standings, [{ placement: 1, name: 'kaiser' }]);
  });

  it('recognises tournament URLs only', () => {
    assert.equal(startggProvider.matchesUrl(new URL('https://www.start.gg/tournament/abc/event/singles')), true);
    assert.equal(startggProvider.matchesUrl(new URL('https://start.gg/user/abc')), false);
    assert.equal(startggProvider.matchesUrl(new URL('https://evil-start.gg.example.com/tournament/x')), false);
  });
});

describe('FACEIT mapping', () => {
  const championship = faceitChampionshipSchema.parse({
    championship_id: '0b5a6b3e-6f0f-4c5e-9d6a-1d2e3f4a5b6c',
    name: 'CS2 Weekly Cup',
    description: '<p>Bring your **best** five.</p>',
    game_id: 'cs2',
    game_data: { long_label: 'Counter-Strike 2' },
    region: 'EU',
    status: 'join',
    faceit_url: 'https://www.faceit.com/{lang}/championship/0b5a6b3e-6f0f-4c5e-9d6a-1d2e3f4a5b6c/CS2%20Weekly%20Cup',
    cover_image: 'https://assets.faceit.com/cover.jpg',
    championship_start: 1_793_000_000_000,
    subscription_end: 1_792_990_000_000,
    slots: 64,
    current_subscriptions: 40,
    full: false,
    prizes: [
      { faceit_points: 1000, rank: 1 },
      { faceit_points: 500, rank: 2 },
    ],
    organizer_data: { name: 'FACEIT Community', faceit_url: 'https://www.faceit.com/{lang}/organizers/x' },
  });

  it('maps millisecond timestamps, url language and registration', () => {
    const t = mapFaceitChampionship(championship)!;
    assert.equal(t.startsAt.toISOString(), new Date(1_793_000_000_000).toISOString());
    assert.equal(t.url, 'https://www.faceit.com/en/championship/0b5a6b3e-6f0f-4c5e-9d6a-1d2e3f4a5b6c/CS2%20Weekly%20Cup');
    assert.equal(t.registration.isOpen, true);
    assert.equal(t.online, true);
    assert.deepEqual(t.participants, { count: 40, cap: 64 });
  });

  it('summarises prizes and strips markup', () => {
    const t = mapFaceitChampionship(championship)!;
    assert.equal(t.prize, '1,500 FACEIT points');
    assert.equal(t.description, 'Bring your best five.');
    assert.equal(t.organizer?.url, 'https://www.faceit.com/en/organizers/x');
  });

  it('closes registration when full or finished', () => {
    assert.equal(mapFaceitChampionship({ ...championship, full: true })!.registration.isOpen, false);
    const finished = mapFaceitChampionship({ ...championship, status: 'finished' })!;
    assert.equal(finished.state, 'completed');
    assert.equal(finished.registration.isOpen, false);
  });

  it('skips championships without an id or start time', () => {
    assert.equal(mapFaceitChampionship({ ...championship, championship_start: null }), null);
  });

  it('recognises championship URLs', () => {
    assert.equal(faceitProvider.matchesUrl(new URL('https://www.faceit.com/en/championship/0b5a6b3e-6f0f-4c5e-9d6a-1d2e3f4a5b6c/x')), true);
    assert.equal(faceitProvider.matchesUrl(new URL('https://www.faceit.com/en/players/someone')), false);
  });
});

describe('tournamentSlug', () => {
  it('is readable, url-safe and stable per provider id', () => {
    const slug = tournamentSlug('Tunis Tekken Monthly #15 — Été', 'startgg', '712345');
    assert.match(slug, /^tunis-tekken-monthly-15-ete-[0-9a-f]{6}$/);
    assert.equal(slug, tournamentSlug('Tunis Tekken Monthly #15 — Été', 'startgg', '712345'));
    assert.notEqual(slug, tournamentSlug('Tunis Tekken Monthly #15 — Été', 'faceit', '712345'));
  });
});
