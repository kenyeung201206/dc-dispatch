/**
 * Turn the day's most interesting creator videos into newspaper stories (with the video playable inside).
 * Leak/datamine titles ⇒ RUMOUR; everything else from creators ⇒ COMMUNITY. Never official.
 */
import type { Item } from '../../src/schema/item.ts';
import { classify, tagsFor } from '../classify.ts';
import { MAX_QUOTE_WORDS } from '../config.ts';
import { score } from '../score.ts';
import { detectLang, extractChars, extractWords, stableId } from '../text.ts';
import { RUMOUR_WORDS, type VideoCandidate } from './videos.ts';

export const MAX_VIDEO_STORIES = 6;
/** Intel-ish topics get picked first, then by views. */
const INTERESTING = /\b(exotic|PTS|leak|datamin\w*|unreleased|build|meta|new season|patch|hotfix|bug|glitch|exploit)\b|奇特|配裝|攻略|漏洞|爆料|新賽季/i;

/** Descriptions are mostly links and hashtags; keep the first real sentences. */
function cleanDescription(d = ''): string {
  return d
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/https?:\/\//.test(l) && !/^#/.test(l) && !/^(\d{1,2}:)?\d{1,2}:\d{2}\b/.test(l))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function videoStories(videos: VideoCandidate[], now: Date): Item[] {
  const picked = [...videos]
    .filter((v) => v.search)
    .sort((a, b) => Number(INTERESTING.test(b.title)) - Number(INTERESTING.test(a.title)) || (b.views ?? 0) - (a.views ?? 0))
    .slice(0, MAX_VIDEO_STORIES);
  return picked.map((v) => {
    const url = `https://www.youtube.com/watch?v=${v.id}`;
    const desc = cleanDescription(v.description);
    const zh = detectLang(v.title) === 'zh';
    const item: Item = {
      id: stableId(url),
      sourceId: 'youtube',
      sourceName: v.channelName ?? 'YouTube',
      sourceUrl: url,
      title_orig: v.title,
      lang_orig: zh ? 'zh' : 'en',
      publishedAt: v.publishedAt,
      fetchedAt: now.toISOString(),
      category: classify(v.title, desc),
      tags: [...tagsFor(v.title, desc), 'video'],
      importance: 0,
      confidence: RUMOUR_WORDS.test(v.title) ? 'rumour' : 'community',
      headline_en: zh ? 'pending' : v.title,
      headline_zhHant: zh ? v.title : 'pending',
      summary_en: zh ? 'pending' : extractWords(desc || v.title, MAX_QUOTE_WORDS),
      summary_zhHant: zh ? extractChars(desc || v.title, 60) : 'pending',
      summaryKind: 'extract',
      alsoReportedBy: [],
      media: [],
      relatedIds: [],
      status: 'new',
      videoId: v.id,
    };
    item.importance = Math.min(100, score(item, 0, now) + Math.min(10, Math.floor(Math.log10((v.views ?? 0) + 1) * 2)));
    return item;
  });
}
