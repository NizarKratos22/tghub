import type { QueryFilter } from 'mongoose';
import type { TournamentList, TournamentStatus } from '@tgh/shared';
import { FINAL_STATES, type TournamentDoc } from './tournament.model';

/**
 * Status is derived, never stored: time passes between syncs, so "open" can
 * become "live" without the provider telling us. The display rule and the
 * query filters below must agree — the tests pin both.
 */

/** When a provider gives no end date, a tournament counts as live this long after it starts. */
export const LIVE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

type StatusInput = Pick<TournamentDoc, 'providerState' | 'startsAt' | 'endsAt' | 'registration'>;

export function deriveStatus(tournament: StatusInput, now = new Date()): TournamentStatus {
  if (tournament.providerState === 'cancelled') return 'cancelled';
  if (tournament.providerState === 'completed') return 'completed';

  const time = now.getTime();
  const start = tournament.startsAt.getTime();
  const end = tournament.endsAt?.getTime() ?? start + LIVE_WINDOW_MS;
  if (time >= end) return 'completed';
  if (time >= start) return 'live';

  const closes = tournament.registration.closesAt?.getTime() ?? null;
  const stillOpenByDate = closes === null || closes > time;
  if (tournament.registration.isOpen === true && stillOpenByDate) return 'registration_open';
  // Provider didn't say, but published a future close date.
  if (tournament.registration.isOpen === null && closes !== null && closes > time) return 'registration_open';
  return 'upcoming';
}

const NOT_FINAL = { providerState: { $nin: FINAL_STATES } };

export function listFilter(list: TournamentList, now = new Date()): QueryFilter<TournamentDoc> {
  const liveCutoff = new Date(now.getTime() - LIVE_WINDOW_MS);
  switch (list) {
    case 'open':
      return {
        ...NOT_FINAL,
        startsAt: { $gt: now },
        $or: [
          { 'registration.isOpen': true, 'registration.closesAt': null },
          { 'registration.isOpen': true, 'registration.closesAt': { $gt: now } },
          { 'registration.isOpen': null, 'registration.closesAt': { $gt: now } },
        ],
      };
    case 'upcoming':
      return { ...NOT_FINAL, startsAt: { $gt: now } };
    case 'live':
      return {
        ...NOT_FINAL,
        startsAt: { $lte: now },
        $or: [{ endsAt: { $gt: now } }, { endsAt: null, startsAt: { $gt: liveCutoff } }],
      };
    case 'completed':
      return {
        $or: [
          { providerState: 'completed' },
          { providerState: { $ne: 'cancelled' }, endsAt: { $lte: now } },
          { providerState: { $ne: 'cancelled' }, endsAt: null, startsAt: { $lte: liveCutoff } },
        ],
      };
  }
}
