import { z } from 'zod';
import { politeGet } from '../http.ts';
import { log } from '../log.ts';
import { parseDuration, RUMOUR_WORDS, type VideoCandidate } from './videos.ts';

/**
 * YouTube oEmbed: public, keyless. 200 = public and embeddable; 401 = embedding disabled;
 * 404 = private/removed. Used to verify every video before listing it (brief §8).
 */
const OEmbed = z.object({ title: z.string(), author_name: z.string(), author_url: z.string() });
export async function checkEmbeddable(id: string, get = politeGet) {
  try {
    const body = await get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`, {
      retries: 1,
    });
    const o = OEmbed.parse(JSON.parse(body));
    return { ok: true as const, title: o.title, channelName: o.author_name, channelUrl: o.author_url };
  } catch (err) {
    log('info', 'video not embeddable or unavailable', { id, error: String(err).slice(0, 80) });
    return { ok: false as const };
  }
}

const PlaylistItems = z.object({
  items: z.array(z.object({ contentDetails: z.object({ videoId: z.string() }) })).default([]),
});
const Videos = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        snippet: z.object({
          title: z.string(),
          channelTitle: z.string(),
          channelId: z.string(),
          publishedAt: z.string(),
          description: z.string().optional(),
          defaultAudioLanguage: z.string().optional(),
        }),
        statistics: z.object({ viewCount: z.string().optional() }).optional(),
        status: z.object({
          embeddable: z.boolean(),
          privacyStatus: z.string(),
          madeForKids: z.boolean().optional(),
        }),
        contentDetails: z.object({ duration: z.string() }),
      }),
    )
    .default([]),
});

export interface Channel {
  id: string;
  name: string;
  official: boolean;
}

/**
 * Latest Division uploads from allowlisted channels via the YouTube Data API.
 * Quota: 2 units per channel (playlistItems.list + videos.list). Skips when no key.
 * The key goes only into the request URL, never into logs.
 */
export async function fetchChannelVideos(
  channels: Channel[],
  key: string | undefined,
  now: Date,
  get = politeGet,
): Promise<VideoCandidate[]> {
  if (!key) {
    log('info', 'YOUTUBE_API_KEY not set: creator videos skipped');
    return [];
  }
  const out: VideoCandidate[] = [];
  const maxAgeMs = 60 * 86_400_000;
  for (const ch of channels) {
    try {
      const uploads = `UU${ch.id.slice(2)}`;
      const pl = PlaylistItems.parse(
        JSON.parse(
          await get(
            `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=15&playlistId=${uploads}&key=${encodeURIComponent(key)}`,
          ),
        ),
      );
      const ids = pl.items.map((i) => i.contentDetails.videoId);
      if (!ids.length) continue;
      const vs = Videos.parse(
        JSON.parse(
          await get(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet,status,contentDetails&id=${ids.join(',')}&key=${encodeURIComponent(key)}`,
          ),
        ),
      );
      for (const v of vs.items) {
        const { status, snippet } = v;
        if (!status.embeddable || status.privacyStatus !== 'public' || status.madeForKids) continue;
        if (!/division|全境封鎖|全境封锁/i.test(snippet.title)) continue;
        if (now.getTime() - Date.parse(snippet.publishedAt) > maxAgeMs) continue;
        out.push({
          id: v.id,
          title: snippet.title,
          channelName: snippet.channelTitle,
          channelUrl: `https://www.youtube.com/channel/${snippet.channelId}`,
          publishedAt: new Date(snippet.publishedAt).toISOString(),
          durationSec: parseDuration(v.contentDetails.duration),
          official: ch.official,
          via: 'youtube-api',
          verified: true,
        });
      }
      log('info', 'youtube channel ok', { channel: ch.name, kept: out.length });
    } catch (err) {
      // Error text can contain the request URL; log only the channel and status.
      log('warn', 'youtube channel failed', { channel: ch.name, error: String(err).replace(/key=[^&\s]+/g, 'key=***').slice(0, 120) });
    }
  }
  return out;
}

const SearchList = z.object({ items: z.array(z.object({ id: z.object({ videoId: z.string().optional() }) })).default([]) });
const DIVISION = /division|全境封鎖|全境封锁/i;

/**
 * Daily creator scan: YouTube search for new Division 2 videos (last 3 days) per query, then one
 * videos.list call to confirm public + embeddable + not made for kids. Quota: 100 units per query
 * + 1 per videos.list call (about 400/day for 4 queries; the free quota is 10,000).
 */
export async function searchVideos(
  queries: { q: string; lang?: string }[],
  key: string | undefined,
  now: Date,
  get = politeGet,
): Promise<VideoCandidate[]> {
  if (!key || !queries.length) return [];
  const since = new Date(now.getTime() - 3 * 86_400_000).toISOString();
  const ids = new Set<string>();
  for (const { q, lang } of queries) {
    try {
      const params = new URLSearchParams({ part: 'id', type: 'video', order: 'date', maxResults: '15', q, publishedAfter: since });
      if (lang) params.set('relevanceLanguage', lang);
      const res = SearchList.parse(JSON.parse(await get(`https://www.googleapis.com/youtube/v3/search?${params}&key=${encodeURIComponent(key)}`)));
      for (const i of res.items) if (i.id.videoId) ids.add(i.id.videoId);
    } catch (err) {
      log('warn', 'youtube search failed', { q, error: String(err).replace(/key=[^&\s]+/g, 'key=***').slice(0, 120) });
    }
  }
  if (!ids.size) return [];
  const out: VideoCandidate[] = [];
  const all = [...ids];
  for (let i = 0; i < all.length; i += 50) {
    let vs: z.infer<typeof Videos>;
    try {
      vs = Videos.parse(
        JSON.parse(
          await get(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status,contentDetails,statistics&id=${all.slice(i, i + 50).join(',')}&key=${encodeURIComponent(key)}`),
        ),
      );
    } catch (err) {
      log('warn', 'youtube videos lookup failed', { error: String(err).replace(/key=[^&\s]+/g, 'key=***').slice(0, 120) });
      continue;
    }
    for (const v of vs.items) {
      const { status, snippet } = v;
      if (!status.embeddable || status.privacyStatus !== 'public' || status.madeForKids) continue;
      if (!DIVISION.test(`${snippet.title} ${snippet.description ?? ''}`)) continue;
      out.push({
        id: v.id,
        title: snippet.title,
        channelName: snippet.channelTitle,
        channelUrl: `https://www.youtube.com/channel/${snippet.channelId}`,
        publishedAt: new Date(snippet.publishedAt).toISOString(),
        durationSec: parseDuration(v.contentDetails.duration),
        official: false,
        via: 'youtube-search',
        verified: true,
        search: true,
        description: (snippet.description ?? '').slice(0, 2000),
        views: Number(v.statistics?.viewCount ?? 0) || 0,
      });
    }
  }
  log('info', 'youtube search ok', { queries: queries.length, found: ids.size, kept: out.length, rumours: out.filter((v) => RUMOUR_WORDS.test(v.title)).length });
  return out;
}
