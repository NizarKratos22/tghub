import type { AlertSourceDoc } from '../alerts.model';

export interface SourceItem {
  /** Stable across fetches — becomes the alert dedupKey and the resource externalId. */
  externalId: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: Date;
  isPatchNotes: boolean;
}

/** One adapter per upstream (Steam today; RSS, Epic, official APIs later). */
export interface SourceAdapter {
  fetch(source: AlertSourceDoc): Promise<SourceItem[]>;
}
