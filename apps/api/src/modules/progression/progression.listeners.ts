import { TRACKABLE_EVENTS } from '@tgh/shared';
import { bus } from '../../core/events/bus';
import { track, unlockByLevel } from './progression.service';

export function registerProgressionListeners(): void {
  for (const event of TRACKABLE_EVENTS) {
    bus.on(event, (payload) => track(event, payload.userId));
  }
  bus.on('progression.level_up', ({ userId, level }) => unlockByLevel(userId, level));
}
