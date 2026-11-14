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

/**
 * New video stories per update (every ~2 h). The owner wants only the 3–6 most interesting and useful ones,
 * not a flood (2026-11-14): the wide searches are for choosing the best, not for showing more. Half Chinese.
 */
export const MAX_VIDEO_STORIES = 6;
/** At most this many stories from one creator per update, so the few places go to different creators. */
export const MAX_PER_CHANNEL = 1;
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

/** The game's own name in the ways creators write it; a title that is only this says nothing. */
const GAME_NAME = /tom\s*clancy'?s|the\s*division\s*2?|division\s*2|td2|全境封[鎖锁]\s*2?|湯姆克蘭西|汤姆克兰西/gi;

/**
 * A video we can't describe without guessing: its title is just the game's name (a stream or a clip) and it
 * has no description. Such a story would stay "全境封鎖2" with nothing to write up, so we leave it out.
 */
export function saysNothing(v: Pick<VideoCandidate, 'title' | 'description'>): boolean {
  const rest = v.title.replace(GAME_NAME, '').replace(/#\S+/g, '').replace(/[\p{P}\p{S}\s\d]+/gu, '');
  return rest.length < 3 && cleanDescription(v.description).length < 20;
}

/**
 * A live stream or Short with almost no description: there is nothing to write a 重點整理 from, and with the
 * wider searches (2026-11-14) many of these turned up. Others the writer can't use go on data/skipped-stories.json.
 */
export function thinVideo(v: Pick<VideoCandidate, 'title' | 'description'>): boolean {
  return cleanDescription(v.description).length < 60 && /\blive\b|\bstream|直播|🔴|#shorts?\b/i.test(v.title);
}

export function videoStories(videos: VideoCandidate[], now: Date): Item[] {
  const perChannel = new Map<string, number>();
  const ranked = [...videos]
    .filter((v) => v.search && !saysNothing(v) && !thinVideo(v))
    // Most interesting topic first, then ones with a real description (so they get a 重點整理), then most viewed.
    .sort(
      (a, b) =>
        Number(INTERESTING.test(b.title)) - Number(INTERESTING.test(a.title)) ||
        Number(cleanDescription(b.description).length >= 120) - Number(cleanDescription(a.description).length >= 120) ||
        (b.views ?? 0) - (a.views ?? 0),
    )
    .filter((v) => {
      const k = v.channelUrl ?? v.channelName ?? v.id;
      const n = perChannel.get(k) ?? 0;
      perChannel.set(k, n + 1);
      return n < MAX_PER_CHANNEL;
    });
  // Keep room for Chinese-speaking creators (up to half), so Chinese readers get videos they can follow.
  const zh = ranked.filter((v) => detectLang(v.title) === 'zh').slice(0, MAX_VIDEO_STORIES / 2);
  const rest = ranked.filter((v) => !zh.includes(v)).slice(0, MAX_VIDEO_STORIES - zh.length);
  const picked = ranked.filter((v) => zh.includes(v) || rest.includes(v));
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
