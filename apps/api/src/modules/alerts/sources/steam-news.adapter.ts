import { z } from 'zod';
import { fetchJson } from '../../../core/http/upstream';
import type { SourceAdapter, SourceItem } from './adapter';

/**
 * Steam's public ISteamNews API, limited to the developer's own community
 * announcements (no third-party press), which is the official channel most
 * PC games use for patch notes.
 */
const responseSchema = z.object({
  appnews: z.object({
    newsitems: z.array(
      z.object({
        gid: z.string(),
        title: z.string(),
        url: z.string(),
        contents: z.string().default(''),
        date: z.number(),
        tags: z.array(z.string()).optional(),
      }),
    ),
  }),
});

const SUMMARY_LENGTH = 260;
const CLAN_IMAGES = 'https://clan.akamai.steamstatic.com/images';
/** Steam clan ids are 64-bit; image paths use the part above this base (the clan's account id). */
const CLAN_ID_BASE = 103582791429521408n;
/** An event and its announcement are published together; this much drift still counts as the same post. */
const SAME_POST_MS = 3 * 24 * 60 * 60 * 1000;

const OPEN_BRACKET = '\u0001';
const CLOSE_BRACKET = '\u0002';

/**
 * Steam announcements are BBCode ([p], [h2], [list], [img]…) where literal
 * brackets are escaped as \[ \]. Reduce to plain text, keeping escaped
 * brackets as text and paragraph breaks as spaces.
 */
export function cleanSteamContents(raw: string): string {
  const text = raw
    .replace(/\\\[/g, OPEN_BRACKET)
    .replace(/\\\]/g, CLOSE_BRACKET)
    .replace(/\[img[^\]]*\][\s\S]*?\[\/img\]/gi, ' ')
    .replace(/\[previewyoutube[^\]]*\][\s\S]*?\[\/previewyoutube\]/gi, ' ')
    .replace(/\{STEAM_CLAN_IMAGE\}\S*/g, ' ')
    .replace(/\[\/?[a-z0-9*]+(?:[= ][^\]]*)?\]/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replaceAll(OPEN_BRACKET, '[')
    .replaceAll(CLOSE_BRACKET, ']')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= SUMMARY_LENGTH) return text;
  const cut = text.slice(0, SUMMARY_LENGTH);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), SUMMARY_LENGTH - 40))}…`;
}

const https = (url: string | undefined | null) => {
  const resolved = url?.trim().replace('{STEAM_CLAN_IMAGE}', CLAN_IMAGES);
  return resolved && /^https:\/\/[^\s"<>]+$/i.test(resolved) ? resolved : null;
};

/** First picture in an announcement: `[img]url[/img]`, `[img src="url"]` or `<img src="url">`, with Steam's {STEAM_CLAN_IMAGE} placeholder resolved. */
export function firstSteamImage(raw: string): string | null {
  const patterns = [/\[img[^\]]*?\ssrc="([^"]+)"/i, /\[img\]\s*([^[\s]+)\s*\[\/img\]/i, /<img[^>]+src="([^"]+)"/i];
  const found = patterns
    .map((pattern) => pattern.exec(raw))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .sort((a, b) => a.index - b.index);
  for (const match of found) {
    const url = https(match[1]);
    if (url) return url;
  }
  return null;
}

const eventsSchema = z.object({
  events: z
    .array(
      z.object({
        event_name: z.string(),
        clan_steamid: z.string(),
        rtime32_start_time: z.number().optional(),
        jsondata: z.string().optional(),
        announcement_body: z.object({ headline: z.string().optional(), posttime: z.number().optional() }).nullish(),
      }),
    )
    .default([]),
});
const eventImagesSchema = z
  .object({
    localized_capsule_image: z.array(z.string().nullable()).optional(),
    localized_title_image: z.array(z.string().nullable()).optional(),
  })
  .catch({});

export interface SteamEventImage {
  title: string;
  postedAt: number;
  url: string;
}

const normalise = (title: string) => title.toLowerCase().replace(/\s+/g, ' ').trim();

/** One event from the store's event list → its header image, if it has one. */
export function eventImage(event: z.infer<typeof eventsSchema>['events'][number]): SteamEventImage | null {
  let images: z.infer<typeof eventImagesSchema>;
  try {
    images = eventImagesSchema.parse(JSON.parse(event.jsondata ?? '{}'));
  } catch {
    return null;
  }
  const hash = images.localized_capsule_image?.[0] ?? images.localized_title_image?.[0];
  if (!hash || !/^[\w.-]+$/.test(hash) || !/^\d+$/.test(event.clan_steamid)) return null;
  const clan = BigInt(event.clan_steamid) - CLAN_ID_BASE;
  if (clan <= 0n) return null;
  return {
    title: normalise(event.announcement_body?.headline ?? event.event_name),
    postedAt: (event.announcement_body?.posttime ?? event.rtime32_start_time ?? 0) * 1000,
    url: `${CLAN_IMAGES}/${clan}/${hash}`,
  };
}

/**
 * The header image Steam shows for each announcement lives on its event, which
 * the news API doesn't return. The store's event list does; it isn't a
 * documented API, so any failure just means "no pictures from Steam".
 */
export async function steamEventImages(appId: number): Promise<SteamEventImage[]> {
  try {
    const url = new URL('https://store.steampowered.com/events/ajaxgetadjacentpartnerevents/');
    url.search = new URLSearchParams({ appid: String(appId), count_before: '0', count_after: '20', lang_list: '0' }).toString();
    const parsed = eventsSchema.safeParse(await fetchJson('Steam', url, { headers: { 'user-agent': 'TGHub-Alerts/0.1 (+https://tghub.tn)' } }));
    return parsed.success ? parsed.data.events.map(eventImage).filter((image): image is SteamEventImage => Boolean(image)) : [];
  } catch {
    return [];
  }
}

/** The event image for a news item: same title, posted within a few days. */
export function matchEventImage(item: { title: string; publishedAt: Date }, events: SteamEventImage[]): string | null {
  const title = normalise(item.title);
  return events.find((event) => event.title === title && Math.abs(event.postedAt - item.publishedAt.getTime()) <= SAME_POST_MS)?.url ?? null;
}

export const steamNewsAdapter: SourceAdapter = {
  label: 'Steam',
  async fetch(source) {
    if (!source.config.appId) throw new Error('This source has no Steam app id');
    const url = new URL('https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/');
    url.searchParams.set('appid', String(source.config.appId));
    url.searchParams.set('count', '10');
    // 0 = full BBCode. A length limit makes Steam strip tags and glue paragraphs together.
    url.searchParams.set('maxlength', '0');
    url.searchParams.set('feeds', 'steam_community_announcements');
    url.searchParams.set('format', 'json');

    const body = await fetchJson('Steam', url, { headers: { 'user-agent': 'TGHub-Alerts/0.1 (+https://tghub.tn)' } });
    const parsed = responseSchema.safeParse(body);
    if (!parsed.success) throw new Error('Steam returned an unexpected payload');
    const events = await steamEventImages(Number(source.config.appId));

    return parsed.data.appnews.newsitems.map<SourceItem>((item) => {
      const publishedAt = new Date(item.date * 1000);
      return {
        externalId: `steam:${item.gid}`,
        kind: item.tags?.includes('patchnotes') || /patch|update|hotfix/i.test(item.title) ? 'patch' : 'news',
        title: item.title.trim(),
        summary: cleanSteamContents(item.contents),
        url: item.url,
        publishedAt,
        // The event header is the picture Steam itself shows for the post; else the first image inside it.
        imageUrl: matchEventImage({ title: item.title, publishedAt }, events) ?? firstSteamImage(item.contents),
      };
    });
  },
};
