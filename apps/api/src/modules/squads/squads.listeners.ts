import { bus } from '../../core/events/bus';
import { onXpAwarded } from './clans.service';

export function registerSquadListeners(): void {
  bus.on('progression.xp_awarded', onXpAwarded);
}
