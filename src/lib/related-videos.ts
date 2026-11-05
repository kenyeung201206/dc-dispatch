/**
 * "Related Chinese videos" for Chinese readers: Chinese-spoken videos (Taiwan / Hong Kong / mainland creators,
 * 灰帽特工's guides) on the same topic as an English story, matched through data/topic-terms.json.
 */
import raw from '../../data/topic-terms.json' with { type: 'json' };
import { z } from 'zod';
import type { Item, Video } from '../schema/item.ts';
import { guides, guideVideo } from './guides.ts';
import { videos } from './videos.ts';
import { hasChinese } from './zh.ts';

const TopicsSchema = z.object({
  _note: z.string().optional(),
  topics: z.array(z.object({ id: z.string().min(1), en: z.string().min(1), zh: z.array(z.string().min(1)).min(1), weight: z.number().int().min(1).max(3) })),
});
const parsed = TopicsSchema.safeParse(raw);
if (!parsed.success) throw new Error(`Invalid data/topic-terms.json: ${parsed.error.message}`);
const topics = parsed.data.topics.map((t) => ({ ...t, re: new RegExp(t.en, 'i'), zh: t.zh.map((w) => w.toLowerCase()) }));

export const MAX_RELATED = 3;

/** Topics an English text is about. */
export function topicsOf(text: string) {
  return topics.filter((t) => t.re.test(text));
}

/** Chinese-spoken videos: creator scan + 灰帽特工 guides (no duplicates). */
function chineseVideos(): { video: Video; guide: boolean }[] {
  const seen = new Set<string>();
  const out: { video: Video; guide: boolean }[] = [];
  for (const gd of guides.filter((g) => g.videoId)) {
    const v = guideVideo(gd);
    if (!seen.has(v.id)) out.push({ video: v, guide: true }), seen.add(v.id);
  }
  for (const v of videos) if (hasChinese(v.title) && !seen.has(v.id)) out.push({ video: v, guide: false }), seen.add(v.id);
  return out;
}

/**
 * Chinese videos about the SAME subject as the story — never just "same DLC".
 * - Story about a named item (weight 3: an exotic, the hidden hunters, the Guardians…): the video must be about
 *   one of those items.
 * - Otherwise the video must share a specific topic (weight 2: master mission, builds, bugs, drops…).
 * - Broad words (weight 1: Central Park, "exotic") only help ranking, they never make a match on their own.
 * No match → empty (the box is hidden) rather than something unrelated.
 */
export function relatedChineseVideos(item: Pick<Item, 'headline_en' | 'summary_en' | 'title_orig' | 'videoId'>, pool = chineseVideos()): Video[] {
  const wanted = topicsOf(`${item.title_orig} ${item.headline_en} ${item.summary_en}`);
  const named = wanted.filter((t) => t.weight === 3);
  const required = named.length ? named : wanted.filter((t) => t.weight === 2);
  if (!required.length) return [];
  return pool
    .filter(({ video }) => video.id !== item.videoId)
    .map(({ video, guide }) => {
      const title = video.title.toLowerCase();
      const has = (t: (typeof wanted)[number]) => t.zh.some((w) => title.includes(w));
      if (!required.some(has)) return { video, score: 0 };
      const score = wanted.filter(has).reduce((s, t) => s + t.weight, 0) + (guide ? 1 : 0);
      return { video, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.video.publishedAt.localeCompare(a.video.publishedAt))
    .slice(0, MAX_RELATED)
    .map((x) => x.video);
}
