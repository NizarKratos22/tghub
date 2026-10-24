import type {
  AlertSource as AlertSourceDto,
  SourceAdapterName,
  SourceInput,
  SourceRunResult,
  SourceUpdateInput,
} from '@tgh/shared';
import { AppError } from '../../../core/http/errors';
import { failureUpdate, isDue, successUpdate } from '../../../core/ingest/source-health';
import { logger } from '../../../core/logger';
import { Game } from '../../games/game.model';
import { gameExists, gameRefMap } from '../../games/games.service';
import { upsertIngestedResource } from '../../radar/radar.service';
import { toSourceDto } from '../alerts.mapper';
import { AlertSource, type AlertSourceDoc } from '../alerts.model';
import { publishAlert } from '../alerts.service';
import type { SourceAdapter } from './adapter';
import { steamNewsAdapter } from './steam-news.adapter';

const adapters: Record<SourceAdapterName, SourceAdapter> = {
  steam_news: steamNewsAdapter,
};

/** On a source's first run, only very recent items become alerts — the rest just fill the Radar. */
const FIRST_RUN_ALERT_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

async function toDtos(docs: AlertSourceDoc[]): Promise<AlertSourceDto[]> {
  const games = await gameRefMap(docs.map((doc) => doc.gameId));
  return docs.map((doc) => toSourceDto(doc, games));
}

export async function listSources(): Promise<AlertSourceDto[]> {
  return toDtos(await AlertSource.find().sort({ name: 1 }).lean<AlertSourceDoc[]>());
}

export async function createSource(input: SourceInput): Promise<AlertSourceDto> {
  if (input.gameId && !(await gameExists(input.gameId))) {
    throw AppError.unprocessable('Unknown game', { fields: { gameId: 'Unknown game' } });
  }
  const doc = await AlertSource.create(input);
  const [dto] = await toDtos([doc.toObject()]);
  return dto!;
}

export async function updateSource(id: string, input: SourceUpdateInput): Promise<AlertSourceDto> {
  // Re-enabling a source gives it a clean slate.
  const set = input.enabled ? { ...input, consecutiveFailures: 0 } : input;
  const doc = await AlertSource.findByIdAndUpdate(id, { $set: set }, { returnDocument: 'after' }).lean<AlertSourceDoc>();
  if (!doc) throw AppError.notFound('Source');
  const [dto] = await toDtos([doc]);
  return dto!;
}

export async function deleteSource(id: string): Promise<void> {
  const result = await AlertSource.deleteOne({ _id: id });
  if (result.deletedCount === 0) throw AppError.notFound('Source');
}

async function run(source: AlertSourceDoc): Promise<SourceRunResult> {
  const startedAt = new Date();
  const adapter = adapters[source.adapter];

  try {
    const items = await adapter.fetch(source);
    const game = source.gameId ? await Game.findById(source.gameId).select('title').lean() : null;
    const sourceName = `${game?.title ?? source.name} · Steam`;
    const alertAfter = source.lastSuccessAt
      ? source.lastSuccessAt.getTime() - 6 * 60 * 60 * 1000
      : startedAt.getTime() - FIRST_RUN_ALERT_WINDOW_MS;

    let newResources = 0;
    let alertsPublished = 0;

    for (const item of items) {
      const created = await upsertIngestedResource({
        externalId: item.externalId,
        kind: item.isPatchNotes ? 'patch' : 'news',
        title: item.title,
        summary: item.summary,
        url: item.url,
        sourceName,
        gameId: source.gameId,
        publishedAt: item.publishedAt,
      });
      if (!created) continue;
      newResources += 1;

      if (item.publishedAt.getTime() >= alertAfter) {
        const { duplicate } = await publishAlert(
          {
            category: source.category,
            title:
              game && !item.title.toLowerCase().includes(game.title.toLowerCase())
                ? `${game.title} — ${item.title}`
                : item.title,
            summary: item.summary,
            url: item.url,
            gameId: source.gameId ? String(source.gameId) : null,
            sourceName,
            dedupKey: item.externalId,
          },
          { sourceId: source._id, publishedAt: item.publishedAt },
        );
        if (!duplicate) alertsPublished += 1;
      }
    }

    const updated = await AlertSource.findByIdAndUpdate(source._id, successUpdate(startedAt, newResources), {
      returnDocument: 'after',
    }).lean<AlertSourceDoc>();

    logger.info({ source: source.name, fetched: items.length, newResources, alertsPublished }, 'Source run complete');
    const [dto] = await toDtos([updated!]);
    return { source: dto!, fetched: items.length, newResources, alertsPublished };
  } catch (error) {
    const updated = await AlertSource.findByIdAndUpdate(source._id, failureUpdate(source, startedAt, error), {
      returnDocument: 'after',
    }).lean<AlertSourceDoc>();

    logger.warn({ source: source.name, err: error instanceof Error ? error.message : error }, 'Source run failed');
    const [dto] = await toDtos([updated!]);
    return { source: dto!, fetched: 0, newResources: 0, alertsPublished: 0 };
  }
}

export async function runSource(id: string): Promise<SourceRunResult> {
  const source = await AlertSource.findById(id).lean<AlertSourceDoc>();
  if (!source) throw AppError.notFound('Source');
  return run(source);
}

/** Job entry point: runs every enabled source whose interval has elapsed. */
export async function runDueAlertSources(): Promise<void> {
  const sources = await AlertSource.find({ enabled: true }).lean<AlertSourceDoc[]>();
  for (const source of sources) {
    if (isDue(source)) await run(source);
  }
}
