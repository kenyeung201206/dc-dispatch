import { z } from 'zod';
import { SOURCES, STEAM_APP_ID, STEAM_OFFICIAL_FEEDS } from '../config.ts';
import { detectLang, toPlainText } from '../text.ts';
import type { RawItem } from './types.ts';

const SteamNews = z.object({
  appnews: z.object({
    appid: z.number(),
    newsitems: z.array(
      z.object({
        gid: z.string(),
        title: z.string(),
        url: z.string(),
        contents: z.string().default(''),
        feedlabel: z.string().default(''),
        feedname: z.string().default(''),
        date: z.number(),
      }),
    ),
  }),
});

/** Parse ISteamNews/GetNewsForApp JSON. Keeps official posts and English press; skips other languages. */
export function parseSteamNews(json: string): RawItem[] {
  const data = SteamNews.parse(JSON.parse(json));
  if (data.appnews.appid !== STEAM_APP_ID) throw new Error(`Unexpected Steam app id ${data.appnews.appid}`);
  const out: RawItem[] = [];
  for (const n of data.appnews.newsitems) {
    const official = STEAM_OFFICIAL_FEEDS.has(n.feedname);
    const text = toPlainText(n.contents);
    const lang = detectLang(`${n.title} ${text.slice(0, 300)}`);
    if (lang !== 'en') continue; // no translator yet for e.g. Russian press
    out.push({
      sourceId: 'steam-news',
      sourceName: official ? 'Ubisoft (via Steam News)' : n.feedlabel || SOURCES['steam-news'].name,
      externalId: n.gid,
      // Canonical, human-readable Steam page instead of the CDN "externalpost" link.
      url: `https://store.steampowered.com/news/app/${STEAM_APP_ID}/view/${n.gid}`,
      title: toPlainText(n.title),
      text,
      rawBody: n.contents,
      publishedAt: new Date(n.date * 1000).toISOString(),
      lang: 'en',
      confidence: official ? 'official' : 'reported',
    });
  }
  return out;
}
