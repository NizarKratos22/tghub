import type { AlertSourceDoc } from '../alerts.model';

export interface SourceItem {
  /** Stable across fetches — becomes the alert dedupKey and the resource externalId. */
  externalId: string;
  kind: 'news' | 'patch' | 'deal';
  title: string;
  summary: string;
  url: string;
  publishedAt: Date;
  /** Header picture for the Radar card, when the source has one (https only). */
  imageUrl: string | null;
  deal?: { store: string; price: number; originalPrice: number | null; currency: string } | null;
  expiresAt?: Date | null;
  /** Ties the item to a catalogue game with this Steam app id, when the source itself isn't about one game. */
  steamAppId?: number | null;
  /** Alert wording when the Radar title alone wouldn't say what happened ("Free to keep on Steam: …"). */
  alertTitle?: string;
}

/** One adapter per upstream (Steam today; RSS, Epic, official APIs later). */
export interface SourceAdapter {
  /** Where items say they come from: "Steam", shown after the game ("Dota 2 · Steam"). */
  label: string;
  fetch(source: AlertSourceDoc): Promise<SourceItem[]>;
}
