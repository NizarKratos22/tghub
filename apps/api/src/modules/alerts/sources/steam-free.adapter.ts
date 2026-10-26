import { z } from 'zod';
import { fetchJson, fetchText } from '../../../core/http/upstream';
import type { SourceAdapter, SourceItem } from './adapter';

/**
 * Steam's free-to-keep giveaways: paid games that are 100% off for a few days.
 * Steam has no API for them, so this reads the store's own search (100% off,
 * price free), each app's details for its picture and usual price, and its
 * store page for the end time. A change on Steam's side shows up as a failing
 * source in Admin → Alert sources.
 */
const STORE = 'https://store.steampowered.com';
const HEADERS = { 'user-agent': 'TGHub-Alerts/0.1 (+https://tghub.tn)' };
/** Store pages print times in the zone this cookie names (UTC here); the birth date gets past age checks. */
const PAGE_COOKIE = 'timezoneOffset=0,0; birthtime=470703601; lastagecheckage=1-January-1985; wants_mature_content=1';
/** Steam's search category for full games — no DLC, soundtracks or software. */
const GAMES_ONLY = '998';
/** Giveaways are a handful at a time; this caps the per-app requests if a sale floods the search. */
const MAX_ITEMS = 12;
const SUMMARY_LENGTH = 260;
const DAY = 24 * 60 * 60 * 1000;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const ENTITIES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
const decode = (text: string) =>
  text.replace(/&(#\d+|[a-z]+);/gi, (whole, name: string) =>
    name.startsWith('#') ? String.fromCodePoint(Number(name.slice(1))) : (ENTITIES[name.toLowerCase()] ?? whole),
  );

export interface FreeSearchRow {
  appId: number;
  title: string;
}

/** Rows of the store search that are 100% off. Bundles and packages (several app ids, or none) are skipped. */
export function parseFreeSearch(html: string): FreeSearchRow[] {
  const rows: FreeSearchRow[] = [];
  for (const match of html.matchAll(/<a\s[^>]*?data-ds-appid="(\d+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const body = match[2]!;
    const title = /<span class="title">([^<]+)<\/span>/.exec(body)?.[1];
    if (!title || /data-discount="(\d+)"/.exec(body)?.[1] !== '100') continue;
    rows.push({ appId: Number(match[1]), title: decode(title.trim()) });
  }
  return rows;
}

/**
 * "Free to keep when you get it before 29 Oct @ 5:00pm" (or "Oct 29", with an
 * optional year) → the moment it ends, read as UTC (see PAGE_COOKIE). Without a
 * year it's this year's date unless that is well past, then next year's.
 */
export function parseFreeUntil(html: string, now = new Date()): Date | null {
  const match =
    /Free to keep when you get it before\s+(?:(\d{1,2})\s+([A-Za-z]{3})|([A-Za-z]{3})\s+(\d{1,2}))(?:,?\s+(\d{4}))?\s*@\s*(\d{1,2}):(\d{2})\s*(am|pm)/i.exec(html);
  if (!match) return null;
  const day = Number(match[1] ?? match[4]);
  const month = MONTHS.indexOf((match[2] ?? match[3])!.toLowerCase());
  if (month < 0 || day < 1 || day > 31) return null;
  const hour = (Number(match[6]) % 12) + (match[8]!.toLowerCase() === 'pm' ? 12 : 0);
  const at = (year: number) => new Date(Date.UTC(year, month, day, hour, Number(match[7])));
  if (match[5]) return at(Number(match[5]));
  const thisYear = at(now.getUTCFullYear());
  return thisYear.getTime() < now.getTime() - 30 * DAY ? at(now.getUTCFullYear() + 1) : thisYear;
}

const searchSchema = z.object({ results_html: z.string() });

const detailsSchema = z.record(
  z.string(),
  z.object({
    success: z.boolean(),
    data: z
      .object({
        name: z.string(),
        short_description: z.string().default(''),
        header_image: z.string().nullish(),
        price_overview: z.object({ currency: z.string(), initial: z.number() }).nullish(),
      })
      .optional(),
  }),
);

function summaryOf(description: string): string {
  const text = decode(description.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  if (text.length <= SUMMARY_LENGTH) return text;
  const cut = text.slice(0, SUMMARY_LENGTH);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), SUMMARY_LENGTH - 40)).trimEnd()}…`;
}

async function freeItem(row: FreeSearchRow, now: Date): Promise<SourceItem> {
  const detailsUrl = new URL(`${STORE}/api/appdetails`);
  // cc=tn: what a player in Tunisia would normally pay (Steam charges USD there).
  detailsUrl.search = new URLSearchParams({ appids: String(row.appId), cc: 'tn', l: 'english', filters: 'basic,price_overview' }).toString();
  const parsed = detailsSchema.safeParse(await fetchJson('Steam', detailsUrl, { headers: HEADERS }));
  const details = parsed.success ? parsed.data[String(row.appId)]?.data : undefined;
  const page = await fetchText('Steam', `${STORE}/app/${row.appId}/?l=english`, { headers: { ...HEADERS, cookie: PAGE_COOKIE } }).catch(() => '');
  const until = parseFreeUntil(page, now);
  const name = (details?.name ?? row.title).trim();
  const image = details?.header_image;

  return {
    // The end date is part of the id, so the same game given away again later is a new deal.
    externalId: `steam-free:${row.appId}:${until ? until.toISOString().slice(0, 10) : 'open'}`,
    kind: 'deal',
    title: name,
    summary: summaryOf(details?.short_description ?? ''),
    url: `${STORE}/app/${row.appId}/`,
    publishedAt: now,
    imageUrl: image && image.startsWith('https://') ? image : null,
    deal: {
      store: 'Steam',
      price: 0,
      originalPrice: details?.price_overview ? details.price_overview.initial / 100 : null,
      currency: details?.price_overview?.currency ?? 'USD',
    },
    expiresAt: until,
    steamAppId: row.appId,
    alertTitle: `Free to keep on Steam: ${name}`,
  };
}

export const steamFreeAdapter: SourceAdapter = {
  label: 'Steam',
  async fetch(source) {
    const url = new URL(`${STORE}/search/results/`);
    url.search = new URLSearchParams({
      maxprice: 'free',
      specials: '1',
      infinite: '1',
      count: '50',
      cc: 'tn',
      l: 'english',
      ...(source.config.includeDlc ? {} : { category1: GAMES_ONLY }),
    }).toString();
    const parsed = searchSchema.safeParse(await fetchJson('Steam', url, { headers: HEADERS }));
    if (!parsed.success) throw new Error('Steam returned an unexpected search payload');

    const now = new Date();
    const items: SourceItem[] = [];
    // One at a time: the store's app details endpoint is rate limited.
    for (const row of parseFreeSearch(parsed.data.results_html).slice(0, MAX_ITEMS)) {
      items.push(await freeItem(row, now));
    }
    return items;
  },
};
