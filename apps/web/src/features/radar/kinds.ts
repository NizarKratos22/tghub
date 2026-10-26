import type { ResourceKind } from '@tgh/shared';
import type { IconName } from '@/components/ui/Icon';
import styles from './RadarCards.module.css';

/** Server-safe: the Radar page builds its tabs from these too. */
export const KIND_ICONS: Record<ResourceKind, IconName> = {
  news: 'bolt',
  patch: 'wrench',
  guide: 'map',
  deal: 'tag',
  event: 'flag',
};

/** Sets the kind's colour variables (--kind, --kind-wash, --kind-text, --kind-solid, --on-kind) for everything inside. */
export const toneClass = (kind: ResourceKind) => styles[`tone_${kind}`];
