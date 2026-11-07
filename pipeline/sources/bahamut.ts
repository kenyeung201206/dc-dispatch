/**
 * 巴哈姆特「湯姆克蘭西：全境封鎖 系列」哈啦板 (bsn=24460).
 * robots.txt allows /B.php and /C.php. We read the board's first list page once a day and keep only
 * 【情報】【攻略】【心得】 posts: title + the list's own short preview + link. Never whole posts, never usernames.
 */
import type { RawItem } from './types.ts';
import { toPlainText } from '../text.ts';

export const BAHAMUT_BOARD = 24460;
export const BAHAMUT_URL = `https://forum.gamer.com.tw/B.php?bsn=${BAHAMUT_BOARD}`;
/** Post types worth printing: intel, guides, write-ups. Questions/chit-chat are skipped. */
export const KEEP_TAGS = new Set(['情報', '攻略', '心得', '密技']);

const TW_OFFSET_MS = 8 * 3_600_000; // Taiwan time, UTC+8

/** Board times are Taiwan local: "2 小時前", "15 分前", "昨天 23:03", "前天 19:55", "11-01 11:20", "2025-12-31". */
export function parseBahaTime(raw: string, now: Date): string | undefined {
  const s = raw.trim();
  const ago = s.match(/^(\d+)\s*(分|小時|天)前$/);
  if (ago) {
    const unit = { 分: 60_000, 小時: 3_600_000, 天: 86_400_000 }[ago[2] as '分' | '小時' | '天'];
    return new Date(now.getTime() - Number(ago[1]) * unit).toISOString();
  }
  // Work in Taiwan wall-clock time, then convert back to UTC.
  const twNow = new Date(now.getTime() + TW_OFFSET_MS);
  const at = (y: number, mo: number, d: number, h = 12, mi = 0) => new Date(Date.UTC(y, mo, d, h, mi) - TW_OFFSET_MS).toISOString();
  const rel = s.match(/^(昨天|前天)\s+(\d{1,2}):(\d{2})$/);
  if (rel) {
    const back = rel[1] === '昨天' ? 1 : 2;
    return at(twNow.getUTCFullYear(), twNow.getUTCMonth(), twNow.getUTCDate() - back, Number(rel[2]), Number(rel[3]));
  }
  const md = s.match(/^(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (md) {
    let y = twNow.getUTCFullYear();
    const mo = Number(md[1]) - 1;
    if (mo > twNow.getUTCMonth()) y -= 1; // "12-30" seen in January = last year
    return at(y, mo, Number(md[2]), Number(md[3]), Number(md[4]));
  }
  const ymd = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) return at(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
  return undefined;
}

const pick = (row: string, re: RegExp) => (row.match(re)?.[1] ?? '').replace(/\s+/g, ' ').trim();

export function parseBahamutBoard(html: string, now: Date): RawItem[] {
  if (!html.includes('b-list__row')) throw new Error('Bahamut board layout changed (no b-list__row)');
  const out: RawItem[] = [];
  // Pinned (sticky) rows are mostly board rules, tagged 【討論】, so the tag filter drops them; but some pinned
  // 【情報】 threads are refreshed by their poster (a daily drops post retitled "11/06 …", a weekly summary).
  for (const part of html.split(/<tr class="b-list__row(?= )/).slice(1)) {
    if (!/^(?: b-list__row--sticky)? b-list-item b-imglist-item"/.test(part)) continue;
    const sticky = part.startsWith(' b-list__row--sticky');
    const row = part;
    const href = pick(row, /href="(C\.php\?bsn=\d+&(?:amp;)?snA=\d+)[^"]*"/).replace('&amp;', '&');
    const titleRaw = toPlainText(pick(row, /b-list__main__title[^>]*>([^<]+)/));
    const tag = titleRaw.match(/^【([^】]{1,4})】/)?.[1];
    if (!href || !titleRaw || !tag || !KEEP_TAGS.has(tag)) continue;
    const snA = href.match(/snA=(\d+)/)?.[1];
    let publishedAt = parseBahaTime(pick(row, /b-list__time__edittime[\s\S]*?>([^<]*\d[^<]*)</), now);
    // A pinned thread retitled with a date ("【情報】11/06 每日…") is that day's post.
    const dated = sticky ? titleRaw.match(/^【[^】]+】\s*(\d{1,2})\/(\d{1,2})/) : null;
    if (dated) publishedAt = parseBahaTime(`${dated[1]}-${dated[2]} 12:00`, now) ?? publishedAt;
    if (!snA || !publishedAt) continue;
    out.push({
      sourceId: 'bahamut',
      sourceName: '巴哈姆特 全境封鎖板',
      externalId: snA,
      url: `https://forum.gamer.com.tw/C.php?bsn=${BAHAMUT_BOARD}&snA=${snA}`,
      title: titleRaw,
      text: toPlainText(pick(row, /b-list__brief[^>]*>([^<]+)/)),
      rawBody: '',
      publishedAt,
      lang: 'zh',
      confidence: 'community',
      tag,
      ...(dated ? { idSuffix: `${dated[1].padStart(2, '0')}-${dated[2].padStart(2, '0')}` } : {}),
    });
  }
  return out;
}

/** Text of a thread's first post (only fetched for the AI summary step; never republished). */
export function parseBahamutFirstPost(html: string, maxChars = 4000): string {
  const m = html.match(/<div class="c-article__content">([\s\S]*?)<\/div>\s*<\/article>/) ?? html.match(/c-article__content[^>]*>([\s\S]{0,8000})/);
  return toPlainText((m?.[1] ?? '').replace(/<br\s*\/?>/gi, ' ')).slice(0, maxChars);
}
