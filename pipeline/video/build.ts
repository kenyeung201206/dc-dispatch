import type { Video } from '../../src/schema/item.ts';
import { log } from '../log.ts';
import { pairRegional, parseUbisoftVideos, rowFor, type VideoCandidate } from './videos.ts';
import { checkEmbeddable, fetchChannelVideos, type Channel } from './youtube.ts';

const DAY = 86_400_000;
/** YouTube API data must be refreshed or deleted within 30 days (Developer Policies III.E.4). */
const MAX_UNVERIFIED_DAYS = 30;
const MAX_VIDEOS = 40;

interface Input {
  enHtml?: string;
  zhHtml?: string;
  previous: Video[];
  channels: Channel[];
  youtubeKey?: string;
  now: Date;
  dryRun: boolean;
  check?: typeof checkEmbeddable;
}

export async function buildVideos({ enHtml, zhHtml, previous, channels, youtubeKey, now, dryRun, check = checkEmbeddable }: Input): Promise<Video[]> {
  const safeParse = (html?: string) => {
    try {
      return html ? parseUbisoftVideos(html) : [];
    } catch (err) {
      log('warn', 'could not read videos from Ubisoft page', { error: String(err) });
      return [];
    }
  };
  const official = pairRegional(safeParse(enHtml), safeParse(zhHtml));
  const creators = await fetchChannelVideos(channels, youtubeKey, now);
  const candidates: (VideoCandidate & { idZh?: string })[] = [...official, ...creators.filter((c) => !official.some((o) => o.id === c.id))];

  const checkedAt = now.toISOString();
  const verified: Video[] = [];
  const rejected = new Set<string>();
  for (const c of candidates) {
    let channelName = c.channelName;
    let channelUrl = c.channelUrl;
    if (!c.verified) {
      if (dryRun) {
        channelName ??= 'Ubisoft';
        channelUrl ??= 'https://www.youtube.com/@Ubisoft';
      } else {
        const r = await check(c.id);
        if (!r.ok) {
          rejected.add(c.id);
          continue;
        }
        channelName = r.channelName;
        channelUrl = r.channelUrl;
      }
    }
    let idZh = c.idZh;
    if (idZh && !dryRun && !(await check(idZh)).ok) idZh = undefined;
    verified.push({
      id: c.id,
      ...(idZh ? { idZh } : {}),
      title: c.title,
      channelName: channelName!,
      channelUrl: channelUrl!,
      publishedAt: c.publishedAt,
      ...(c.durationSec ? { durationSec: c.durationSec } : {}),
      official: c.official,
      row: rowFor(c.title),
      checkedAt,
      via: c.via,
    });
  }

  // Keep yesterday's videos only while still inside the 30-day refresh window and not rejected today.
  const carried = previous.filter(
    (p) =>
      !verified.some((v) => v.id === p.id) &&
      !rejected.has(p.id) &&
      now.getTime() - Date.parse(p.checkedAt) < MAX_UNVERIFIED_DAYS * DAY,
  );
  const all = [...verified, ...carried].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, MAX_VIDEOS);
  log('info', 'videos', { verified: verified.length, carried: carried.length, rejected: rejected.size, total: all.length });
  return all;
}
