import { Router } from 'express';
import type { HomeFeed } from '@tgh/shared';
import { handle } from '../../core/http/handler';
import { featuredGames } from '../games/games.service';
import { latestListings } from '../market/listings.service';
import { currentPulse, leaderboard } from '../progression/progression.service';
import { dealsEndingSoon, latestNews, tickerItems } from '../radar/radar.service';
import { tournamentsForHome } from '../tournaments/tournaments.service';

/**
 * One round trip for the front page — the web and the mobile app's home tab
 * both read this instead of stitching six requests together.
 */
export const homeRouter = Router();

homeRouter.get(
  '/',
  handle({}, async (): Promise<HomeFeed> => {
    const [featured, latest, deals, tournaments, pulse, leaders, ticker, listings] = await Promise.all([
      featuredGames(10),
      latestNews(6),
      dealsEndingSoon(4),
      tournamentsForHome(5),
      currentPulse(),
      leaderboard(5),
      tickerItems(8),
      latestListings(10),
    ]);
    return { featured, latest, deals, tournaments, pulse, leaders, ticker, listings };
  }),
);
