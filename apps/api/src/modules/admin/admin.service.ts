import type { PipelineStage } from 'mongoose';
import type { AdminOverview, AdminStats, AdminStatsMetric, AdminStatsPoint } from '@tgh/shared';
import { dayKey, startOfLocalDay } from '../../core/time/periods';
import { Alert, AlertSource, Notification } from '../alerts/alerts.model';
import { Game } from '../games/game.model';
import { categoryCounts } from '../market/listings.service';
import { ListingReport, Listing, MarketMessage } from '../market/market.model';
import { marketOverview, recentListingsForAdmin } from '../market/moderation.service';
import { XpLedger } from '../progression/progression.model';
import { Resource } from '../radar/resource.model';
import { upcomingCount } from '../tournaments/tournaments.service';
import { User, type UserDoc } from '../users/user.model';
import { toAdminUser } from '../users/users.mapper';

const DAY_MS = 86_400_000;

export async function overview(): Promise<AdminOverview> {
  const now = Date.now();
  const day = new Date(now - DAY_MS);
  const week = new Date(now - 7 * DAY_MS);

  const [users, newUsers7d, games, resources, alerts24h, notifications24h, failingSources, xp, upcomingTournaments, market] = await Promise.all([
    User.estimatedDocumentCount(),
    User.countDocuments({ createdAt: { $gte: week } }),
    Game.countDocuments(),
    Resource.countDocuments(),
    Alert.countDocuments({ createdAt: { $gte: day } }),
    Notification.countDocuments({ createdAt: { $gte: day } }),
    AlertSource.countDocuments({ $or: [{ enabled: false }, { consecutiveFailures: { $gt: 0 } }] }),
    XpLedger.aggregate<{ total: number }>([
      { $match: { createdAt: { $gte: week } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    upcomingCount(),
    marketOverview(),
  ]);

  return {
    users,
    newUsers7d,
    games,
    resources,
    alerts24h,
    notifications24h,
    failingSources,
    xpAwarded7d: xp[0]?.total ?? 0,
    upcomingTournaments,
    ...market,
  };
}

/* ───────────── Dashboard series ───────────── */

interface DayRow {
  _id: string;
  value: number;
}

const METRICS: AdminStatsMetric[] = ['signups', 'listings', 'messages', 'reports', 'xp', 'alerts'];

/** Counts (or sums) per Tunis-local day since `from`. */
function perDay(from: Date, sum?: string): PipelineStage[] {
  return [
    { $match: { createdAt: { $gte: from } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Africa/Tunis' } },
        value: sum ? { $sum: sum } : { $sum: 1 },
      },
    },
  ];
}

/**
 * Daily activity for the dashboard. One query per collection covers this
 * window and the previous one, so every total comes with a comparison.
 */
export async function stats(days: number): Promise<AdminStats> {
  // Noon of each local day keeps the key stable whatever the server's own zone is.
  const today = startOfLocalDay();
  const from = new Date(today.getTime() - (2 * days - 1) * DAY_MS);
  const keys = Array.from({ length: 2 * days }, (_, i) => dayKey(new Date(from.getTime() + i * DAY_MS + DAY_MS / 2)));

  const [signups, listings, messages, reports, xp, alerts, byCategory, recentUsers, recentListings] = await Promise.all([
    User.aggregate<DayRow>(perDay(from)),
    Listing.aggregate<DayRow>(perDay(from)),
    MarketMessage.aggregate<DayRow>(perDay(from)),
    ListingReport.aggregate<DayRow>(perDay(from)),
    XpLedger.aggregate<DayRow>(perDay(from, '$amount')),
    Alert.aggregate<DayRow>(perDay(from)),
    categoryCounts(),
    User.find().sort({ createdAt: -1 }).limit(6).lean<UserDoc[]>(),
    recentListingsForAdmin(6),
  ]);

  const rows: Record<AdminStatsMetric, Map<string, number>> = {
    signups: new Map(signups.map((row) => [row._id, row.value])),
    listings: new Map(listings.map((row) => [row._id, row.value])),
    messages: new Map(messages.map((row) => [row._id, row.value])),
    reports: new Map(reports.map((row) => [row._id, row.value])),
    xp: new Map(xp.map((row) => [row._id, row.value])),
    alerts: new Map(alerts.map((row) => [row._id, row.value])),
  };
  const points: AdminStatsPoint[] = keys.map((day) => ({
    day,
    signups: rows.signups.get(day) ?? 0,
    listings: rows.listings.get(day) ?? 0,
    messages: rows.messages.get(day) ?? 0,
    reports: rows.reports.get(day) ?? 0,
    xp: rows.xp.get(day) ?? 0,
    alerts: rows.alerts.get(day) ?? 0,
  }));

  const total = (slice: AdminStatsPoint[]) =>
    Object.fromEntries(METRICS.map((metric) => [metric, slice.reduce((sum, point) => sum + point[metric], 0)])) as Record<AdminStatsMetric, number>;
  const previous = points.slice(0, days);
  const series = points.slice(days);

  return {
    days,
    series,
    totals: total(series),
    previous: total(previous),
    listingsByCategory: byCategory.sort((a, b) => b.count - a.count),
    recentSignups: recentUsers.map(toAdminUser),
    recentListings,
  };
}
