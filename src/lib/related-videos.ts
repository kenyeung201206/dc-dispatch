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
 * Best Chinese videos for a story: score = sum of matched topic weights (+1 for a curated guide).
 * Specific topics (weight ≥ 2, or two broad ones) win; with none, broad matches such as the same DLC are used.
 */
export function relatedChineseVideos(item: Pick<Item, 'headline_en' | 'summary_en' | 'title_orig' | 'videoId'>, pool = chineseVideos()): Video[] {
  const wanted = topicsOf(`${item.title_orig} ${item.headline_en} ${item.summary_en}`);
  if (!wanted.length) return [];
  const scored = pool
    .filter(({ video }) => video.id !== item.videoId)
    .map(({ video, guide }) => {
      const title = video.title.toLowerCase();
      const hits = wanted.filter((t) => t.zh.some((w) => title.includes(w)));
      const score = hits.reduce((s, t) => s + t.weight, 0);
      return { video, score: score ? score + (guide ? 1 : 0) : 0, strong: hits.some((t) => t.weight >= 2) || hits.length >= 2 };
    })
    .filter((x) => x.score > 0);
  // Specific matches when there are any; otherwise the best broad ones (e.g. same DLC), curated guides first.
  const best = scored.some((x) => x.strong) ? scored.filter((x) => x.strong) : scored;
  return best
    .sort((a, b) => b.score - a.score || b.video.publishedAt.localeCompare(a.video.publishedAt))
    .slice(0, MAX_RELATED)
    .map((x) => x.video);
}
