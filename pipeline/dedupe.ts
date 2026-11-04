import type { RawItem } from './sources/types.ts';
import { titleSimilarity } from './text.ts';

export interface Story {
  primary: RawItem;
  others: RawItem[];
}

const SIMILAR = 0.7;
const MAX_DAYS_APART = 3;

/** Preference for the "main" copy of a story: Ubisoft site > official Steam post > press. */
const rank = (r: RawItem) => (r.sourceId === 'ubisoft-en' ? 0 : r.confidence === 'official' ? 1 : 2);

/** Query parameters that never identify content (tracking, display options). */
const NOISE_PARAMS = /^(utm_.*|fbclid|gclid|ref|tnum|cc_lang_pref|cc_load_policy|hl|t)$/i;

export function canonicalUrl(raw: string): string {
  const u = new URL(raw);
  u.hash = '';
  // Keep identifying params (e.g. 巴哈 ?bsn=…&snA=…, YouTube ?v=…); drop tracking ones; sort for stability.
  const kept = [...u.searchParams].filter(([k]) => !NOISE_PARAMS.test(k)).sort(([a], [b]) => a.localeCompare(b));
  u.search = kept.length ? `?${new URLSearchParams(kept).toString()}` : '';
  u.hostname = u.hostname.toLowerCase();
  return u.href.replace(/\/$/, '');
}

/** Title-update tag at the start of patch-note titles, e.g. "[TUY8S3.3]". */
const tuTag = (title: string) => /^\s*\[TU\s*(Y\d+S\d+(?:\.\d+)*)\]/i.exec(title)?.[1]?.toUpperCase();

function sameStory(a: RawItem, b: RawItem): boolean {
  if (canonicalUrl(a.url) === canonicalUrl(b.url)) return true;
  const days = Math.abs(Date.parse(a.publishedAt) - Date.parse(b.publishedAt)) / 86_400_000;
  if (days > MAX_DAYS_APART) return false;
  // Same title update's notes posted on Steam and Ubisoft under different titles.
  const tag = tuTag(a.title);
  if (tag && tag === tuTag(b.title)) return true;
  return titleSimilarity(a.title, b.title) >= SIMILAR;
}

/** Group duplicates (same URL, or near-identical title within a few days) into stories. */
export function dedupe(items: RawItem[]): Story[] {
  const sorted = [...items].sort((a, b) => rank(a) - rank(b));
  const stories: Story[] = [];
  for (const item of sorted) {
    const hit = stories.find((s) => sameStory(s.primary, item) || s.others.some((o) => sameStory(o, item)));
    if (hit) hit.others.push(item);
    else stories.push({ primary: item, others: [] });
  }
  return stories;
}
