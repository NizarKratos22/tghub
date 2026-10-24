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

export const steamNewsAdapter: SourceAdapter = {
  async fetch(source) {
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

    return parsed.data.appnews.newsitems.map<SourceItem>((item) => ({
      externalId: `steam:${item.gid}`,
      title: item.title.trim(),
      summary: cleanSteamContents(item.contents),
      url: item.url,
      publishedAt: new Date(item.date * 1000),
      isPatchNotes: Boolean(item.tags?.includes('patchnotes')) || /patch|update|hotfix/i.test(item.title),
    }));
  },
};
