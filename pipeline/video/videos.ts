import { z } from 'zod';
import type { Video } from '../../src/schema/item.ts';
import { extractPreloadedState } from '../sources/ubisoft.ts';
import { titleSimilarity } from '../text.ts';

/** A video candidate before the embeddable check. */
export interface VideoCandidate {
  id: string;
  title: string;
  channelName?: string;
  channelUrl?: string;
  publishedAt: string;
  durationSec?: number;
  official: boolean;
  via: Video['via'];
  /** Set when the YouTube API already confirmed public + embeddable + not made for kids. */
  verified?: boolean;
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const UbiVideo = z.object({
  type: z.literal('videos'),
  date: z.string(),
  button: z.object({ buttonUrl: z.string() }),
  thumbnail: z.object({ description: z.string().nullish() }).nullish(),
  title: z.string().nullish(),
});

/** Official videos listed on Ubisoft's Division 2 news page (no API key needed). */
export function parseUbisoftVideos(html: string): VideoCandidate[] {
  const out: VideoCandidate[] = [];
  const walk = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    const p = UbiVideo.safeParse(n);
    if (p.success) {
      const id = p.data.button.buttonUrl.split('?')[0]!;
      const title = p.data.title ?? p.data.thumbnail?.description ?? '';
      const date = new Date(p.data.date);
      if (YT_ID.test(id) && title && !Number.isNaN(date.getTime()) && !out.some((v) => v.id === id)) {
        out.push({ id, title, publishedAt: date.toISOString(), official: true, via: 'ubisoft-page' });
      }
      return;
    }
    Object.values(n).forEach(walk);
  };
  walk(extractPreloadedState(html));
  return out;
}

/** "[ESRB] Foo - Launch Trailer" and "Foo - Launch Trailer" are the same video for different regions. */
const stripRating = (t: string) => t.replace(/^\s*\[[A-Z]+\]\s*/, '');

/** Pair each English-page video with the zh-TW page's regional upload of the same title. */
export function pairRegional(en: VideoCandidate[], zh: VideoCandidate[]): (VideoCandidate & { idZh?: string })[] {
  return en.map((v) => {
    const twin = zh.find((z) => z.id !== v.id && titleSimilarity(stripRating(z.title), stripRating(v.title)) >= 0.9);
    return twin ? { ...v, idZh: twin.id } : v;
  });
}

/** Which Watch Now row a video belongs in. */
export function rowFor(title: string): Video['row'] {
  if (/\b(trailer|teaser)\b/i.test(title)) return 'trailers';
  if (/\b(patch|title update|TU ?Y\d|update notes|hotfix|changes)\b/i.test(title)) return 'patch-breakdowns';
  if (/\b(builds?|loadouts?|guides?|tier lists?|meta)\b/i.test(title)) return 'build-guides';
  return 'more';
}

/** ISO 8601 duration (PT1H2M3S) → seconds. */
export function parseDuration(iso: string): number | undefined {
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return undefined;
  const s = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return s > 0 ? s : undefined;
}

export { stripRating };
