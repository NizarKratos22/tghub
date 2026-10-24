import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deriveStatus, LIVE_WINDOW_MS } from './tournament.status';

const NOW = new Date('2026-10-24T12:00:00Z');
const hours = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

const tournament = (overrides: Partial<Parameters<typeof deriveStatus>[0]> = {}) => ({
  providerState: null,
  startsAt: hours(48),
  endsAt: null,
  registration: { isOpen: null, closesAt: null },
  ...overrides,
});

describe('deriveStatus', () => {
  it('trusts final provider states over dates', () => {
    assert.equal(deriveStatus(tournament({ providerState: 'cancelled' }), NOW), 'cancelled');
    assert.equal(deriveStatus(tournament({ providerState: 'completed' }), NOW), 'completed');
  });

  it('is open while the provider says so and the close date is ahead', () => {
    assert.equal(deriveStatus(tournament({ registration: { isOpen: true, closesAt: hours(24) } }), NOW), 'registration_open');
    assert.equal(deriveStatus(tournament({ registration: { isOpen: true, closesAt: null } }), NOW), 'registration_open');
  });

  it('closes when the close date passes even if the last sync said open', () => {
    assert.equal(deriveStatus(tournament({ registration: { isOpen: true, closesAt: hours(-1) } }), NOW), 'upcoming');
  });

  it('infers open from a future close date when the provider is silent', () => {
    assert.equal(deriveStatus(tournament({ registration: { isOpen: null, closesAt: hours(5) } }), NOW), 'registration_open');
    assert.equal(deriveStatus(tournament({ registration: { isOpen: false, closesAt: hours(5) } }), NOW), 'upcoming');
  });

  it('goes live at the start time without waiting for a sync', () => {
    assert.equal(deriveStatus(tournament({ startsAt: hours(-1), registration: { isOpen: true, closesAt: null } }), NOW), 'live');
  });

  it('completes at the end date, or after the live window when there is none', () => {
    assert.equal(deriveStatus(tournament({ startsAt: hours(-5), endsAt: hours(-1) }), NOW), 'completed');
    const longAgo = new Date(NOW.getTime() - LIVE_WINDOW_MS - 1);
    assert.equal(deriveStatus(tournament({ startsAt: longAgo }), NOW), 'completed');
  });
});
