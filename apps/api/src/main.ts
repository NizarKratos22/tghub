import { env } from './config/env';
import { createApp } from './app';
import { connectMongo, disconnectMongo } from './core/db/mongo';
import { bus } from './core/events/bus';
import { logger } from './core/logger';
import { recordError } from './core/monitoring/error-log';
import { realtime } from './core/realtime/hub';
import { registerJob, startJobs, stopJobs } from './core/ingest/jobs';
import { registerAlertListeners } from './modules/alerts/alerts.listeners';
import { syncIgdbCatalogue } from './modules/games/games.igdb';
import { deleteOrphanedMedia } from './modules/media/media.service';
import { runDueAlertSources } from './modules/alerts/sources/sources.service';
import { registerProgressionListeners } from './modules/progression/progression.listeners';
import { refreshClanXp } from './modules/squads/clans.service';
import { refreshAllSellerBadges } from './modules/market/reputation.service';
import { reconcilePendingOrders } from './modules/payments/payments.service';
import { registerSocialListeners } from './modules/social/social.listeners';
import { registerSquadListeners } from './modules/squads/squads.listeners';
import { refreshActiveTournaments, runDueTournamentSources, sendTournamentReminders } from './modules/tournaments/tournaments.sync';

const MINUTE = 60_000;

async function main() {
  await connectMongo();

  registerProgressionListeners();
  registerAlertListeners();
  registerSquadListeners();
  registerSocialListeners();
  // Reminders read our own database, so they always run. Polling third parties is opt-in.
  registerJob({ name: 'tournament-reminders', everyMs: 5 * MINUTE, run: () => sendTournamentReminders() });
  registerJob({ name: 'media-cleanup', everyMs: 60 * MINUTE, run: deleteOrphanedMedia });
  // Live increments keep standings current; this catches season rollovers and drift.
  registerJob({ name: 'clan-xp', everyMs: 15 * MINUTE, run: () => refreshClanXp() });
  registerJob({ name: 'seller-badges', everyMs: 6 * 60 * MINUTE, run: refreshAllSellerBadges });
  registerJob({ name: 'payments-reconcile', everyMs: 5 * MINUTE, run: reconcilePendingOrders });
  // Game data comes from IGDB as soon as its keys are set (the keys are the opt-in).
  if (env.igdb) registerJob({ name: 'igdb-sync', everyMs: 6 * 60 * MINUTE, run: () => syncIgdbCatalogue() });
  if (env.INGESTION_ENABLED) {
    registerJob({ name: 'alert-sources', everyMs: 5 * MINUTE, run: runDueAlertSources });
    registerJob({ name: 'tournament-sources', everyMs: 10 * MINUTE, run: runDueTournamentSources });
    registerJob({ name: 'tournament-refresh', everyMs: 10 * MINUTE, run: () => refreshActiveTournaments() });
  }
  startJobs();

  const server = createApp().listen(env.PORT, () => {
    logger.info(`TG Hub API listening on http://localhost:${env.PORT}`);
    logger.info(env.r2 ? `Uploads go to Cloudflare R2 "${env.r2.bucket}/${env.r2.prefix}"` : `Uploads go to ${env.MEDIA_DIR}`);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    stopJobs();
    realtime.closeAll();
    server.close();
    await bus.drain();
    await disconnectMongo();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

// Crashes outside a request still reach the admin Errors page.
process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.error({ err: error }, 'Unhandled promise rejection');
  void recordError({ source: 'api', name: error.name, message: error.message, stack: error.stack, where: 'unhandledRejection' });
});

main().catch((error) => {
  logger.fatal({ err: error }, 'API failed to start');
  process.exit(1);
});
