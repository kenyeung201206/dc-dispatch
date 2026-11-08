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

/** Ubisoft's article id in its news URLs (the slug after it can change when Ubisoft retitles a post). */
const ubiArticle = (url: string) => /\/news-updates\/([A-Za-z0-9]{15,})(?:\/|$)/.exec(url)?.[1];

/**
 * A point release named anywhere in a patch-notes title, in any language:
 * "[TUY8S3.3] …", "【情報】TU29.3 / Y8S3.3 Patchnote翻譯…". Needs the point (".3") so a season name alone
 * ("Y8S3 獵捕任務") never matches.
 */
const PATCHY = /patch|notes?\b|更新|修正|\bTU\s?(?:\d|Y\d)/i;
const patchVersion = (title: string) => (PATCHY.test(title) ? /\bY(\d+)S(\d+)\.(\d+)/i.exec(title.replace(/TU(?=Y)/i, ' '))?.slice(1).join('.') : undefined);

/** Twitch drops campaign dates, "November 3 – November 10" or "11/03 - 11/10" → "11-03/11-10". */
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
function dropsWindow(text: string): string | undefined {
  if (!/twitch/i.test(text) || !/drop|掉寶/i.test(text)) return undefined;
  const p2 = (n: number | string) => String(n).padStart(2, '0');
  const zh = /(\d{1,2})\/(\d{1,2})\s*[-–~～至]\s*(\d{1,2})\/(\d{1,2})/.exec(text);
  if (zh) return `${p2(zh[1]!)}-${p2(zh[2]!)}/${p2(zh[3]!)}-${p2(zh[4]!)}`;
  const en = new RegExp(`(${MONTHS.join('|')})\\s+(\\d{1,2})\\s*[-–~]\\s*(?:(${MONTHS.join('|')})\\s+)?(\\d{1,2})`, 'i').exec(text);
  if (!en) return undefined;
  const m1 = MONTHS.indexOf(en[1]!.toLowerCase()) + 1;
  const m2 = en[3] ? MONTHS.indexOf(en[3].toLowerCase()) + 1 : m1;
  return `${p2(m1)}-${p2(en[2]!)}/${p2(m2)}-${p2(en[4]!)}`;
}

/** Official "it's out" posts: Ubisoft's "… is available now!" and Steam's "Play … Today!" are one story. */
const LAUNCH = /\b(out now|available now|is (?:here|live)|play\b.*\btoday)\b|今天開玩|正式推出|現已推出/i;
const NOT_LAUNCH = /livestream|stream\b|contest|pre-?purchase|pre-?order|drops?\b|直播|比賽|預購|掉寶/i;
const isLaunch = (r: RawItem) => r.confidence === 'official' && LAUNCH.test(r.title) && !NOT_LAUNCH.test(r.title);

function sameStory(a: RawItem, b: RawItem): boolean {
  if (canonicalUrl(a.url) === canonicalUrl(b.url)) return true;
  const ua = ubiArticle(a.url);
  if (ua && ua === ubiArticle(b.url)) return true;
  const days = Math.abs(Date.parse(a.publishedAt) - Date.parse(b.publishedAt)) / 86_400_000;
  if (days > MAX_DAYS_APART) return false;
  // Same title update's notes posted on Steam and Ubisoft under different titles.
  const tag = tuTag(a.title);
  if (tag && tag === tuTag(b.title)) return true;
  // Same point release relayed in another language (巴哈's translation of Ubisoft's notes).
  const pv = patchVersion(a.title);
  if (pv && pv === patchVersion(b.title)) return true;
  // Same Twitch drops campaign announced by Ubisoft and relayed on 巴哈.
  const dw = dropsWindow(`${a.title} ${a.text}`);
  if (dw && dw === dropsWindow(`${b.title} ${b.text}`)) return true;
  // Ubisoft's and Steam's "it's out" posts for the same release.
  if (days <= 2 && isLaunch(a) && isLaunch(b)) return true;
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
