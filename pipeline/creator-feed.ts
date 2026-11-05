/**
 * Reads 灰帽特工's YouTube posts tab and adds posts we haven't handled yet to data/creator-posts.json:
 *   - 「獵捕偵查任務 N」 → a new entry in that season's mission list (also runs as a story while fresh)
 *   - anything else → a post (story in its section + the Guides page)
 * Text is his own Chinese; English pages show it as-is until someone writes an English version.
 * Fails soft: if YouTube changes its page, the run logs a warning and keeps the existing data.
 */
import type { CreatorPosts } from '../src/schema/item.ts';

export interface FeedPost {
  postId: string;
  text: string;
  /** As YouTube shows it: "21 小時前", "2 weeks ago" … */
  ago: string;
  /** First outside link in the post (YouTube's redirect unwrapped). */
  link?: string;
}

const DAY = 86_400_000;

/** Pulls the posts out of the page's embedded ytInitialData. */
export function parsePostsPage(html: string): FeedPost[] {
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!m) return [];
  const found: FeedPost[] = [];
  const walk = (o: unknown): void => {
    if (!o || typeof o !== 'object') return;
    const r = (o as { backstagePostRenderer?: Record<string, any> }).backstagePostRenderer;
    if (r) {
      const runs: any[] = r.contentText?.runs ?? [];
      let link: string | undefined;
      const text = runs
        .map((run) => {
          const raw: string | undefined = run.navigationEndpoint?.urlEndpoint?.url;
          if (!raw) return run.text ?? '';
          const url = unwrap(raw);
          if (!link && url && !/youtube\.com|youtu\.be/.test(url)) link = url;
          return url ?? run.text ?? '';
        })
        .join('')
        .trim();
      const ago = (r.publishedTimeText?.runs ?? []).map((x: any) => x.text).join('');
      if (r.postId && text) found.push({ postId: r.postId, text, ago, link });
      return;
    }
    for (const v of Object.values(o)) walk(v);
  };
  try {
    walk(JSON.parse(m[1]!));
  } catch {
    return [];
  }
  return found;
}

function unwrap(url: string): string | undefined {
  try {
    const u = new URL(url, 'https://www.youtube.com');
    const q = u.pathname === '/redirect' ? u.searchParams.get('q') : u.href;
    return q && q.startsWith('https://') ? q : undefined;
  } catch {
    return undefined;
  }
}

/** "21 小時前" / "2 weeks ago" → the day he posted (approximate for weeks and months). */
export function agoToDate(ago: string, now: Date): string {
  const n = Number(ago.match(/\d+/)?.[0] ?? 0);
  const units: [RegExp, number][] = [
    [/秒|second/i, 1000],
    [/分鐘|分钟|minute/i, 60_000],
    [/小時|小时|hour/i, 3_600_000],
    [/天|day/i, DAY],
    [/週|周|星期|week/i, 7 * DAY],
    [/個月|个月|month/i, 30 * DAY],
    [/年|year/i, 365 * DAY],
  ];
  const unit = units.find(([re]) => re.test(ago))?.[1] ?? 0;
  return new Date(now.getTime() - n * unit).toISOString().slice(0, 10);
}

const addDays = (d: string, days: number) => new Date(Date.parse(`${d}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const postUrl = (id: string) => `https://www.youtube.com/post/${id}`;
const lines = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean);
const STEP = /^\d+\s*[.、．:：)]\s*(.+)$/;
const GREETING = /^(特工們|特工们|各位特工)\s*[:：!！]?$/;

function guessCategory(text: string): CreatorPosts['posts'][number]['category'] {
  if (/維護|維修|停機|更新日志|更新日誌|patch|maintenance/i.test(text)) return 'updates';
  if (/配裝|配装|build/i.test(text)) return 'builds';
  if (/DLC|新賽季|新赛季|資料片/i.test(text) && !/兌換|twitch|掉寶/i.test(text)) return 'franchise';
  return 'community';
}

/**
 * Adds every post we haven't seen to `data`. Returns what was added (for the log).
 * A post counts as seen if its URL is already used anywhere, or its id is in knownPostIds.
 */
export function mergeFeed(data: CreatorPosts, feed: FeedPost[], now: Date): { missions: string[]; posts: string[] } {
  const today = now.toISOString().slice(0, 10);
  const known = new Set(data.knownPostIds ?? []);
  const used = JSON.stringify(data);
  const added = { missions: [] as string[], posts: [] as string[] };

  // Oldest first, so missions land in order.
  for (const p of [...feed].reverse()) {
    if (known.has(p.postId) || used.includes(p.postId)) {
      known.add(p.postId);
      continue;
    }
    known.add(p.postId);
    const publishedAt = agoToDate(p.ago, now);
    const all = lines(p.text);

    const mission = p.text.match(/獵捕偵查任務\s*(\d+)/);
    if (mission) {
      const n = Number(mission[1]);
      const season = p.text.match(/Y(\d+)\s*S(\d+)/i);
      const id = season ? `y${season[1]}s${season[2]}-manhunt-scouts` : undefined;
      let series = data.series.find((s) => s.id === id) ?? (id ? undefined : [...data.series].sort((a, b) => b.id.localeCompare(a.id))[0]);
      if (!series && id) {
        const tag = `Y${season![1]}S${season![2]}`;
        series = {
          id,
          title_zhHant: `${tag} 獵捕偵查任務`,
          title_en: `${tag} Manhunt Scouts`,
          total: 11,
          until: addDays(today, 90),
          untilNote: 'Added by the robot: total and season end are guesses; fix them when Ubisoft announces the season.',
          entries: [],
        };
        data.series.unshift(series);
      }
      const steps = all.map((l) => l.match(STEP)?.[1]).filter((s): s is string => !!s);
      if (series && steps.length && !series.entries.some((e) => e.n === n)) {
        const rest = all.slice(1).filter((l) => !STEP.test(l)).join(' ');
        const final = /完/.test(all[0] ?? '') || n >= series.total;
        series.entries.push({
          n,
          ...(final ? { final: true } : {}),
          steps_zhHant: steps,
          steps_en: steps,
          ...(rest ? { result_zhHant: rest, result_en: rest } : {}),
          postUrl: postUrl(p.postId),
          seen: today,
          publishedAt,
        });
        if (n > series.total) series.total = n;
        added.missions.push(`${series.title_zhHant} ${n}`);
        continue;
      }
    }

    const CODE = /\b[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}\b/g;
    const body = all.filter((l) => !GREETING.test(l));
    const title = (body[0] ?? all[0] ?? '灰帽特工更新').replace(/[:：!！。]+$/, '').slice(0, 40);
    // Links and codes show as their own button/chips, so leave them (and their labels) out of the text.
    const text =
      body
        .slice(1)
        .filter((l) => !/^https?:\/\/\S+$/.test(l) && !/^(兌換鏈接|兑换链接|兌換連結|更新日志|更新日誌|連結|链接|CDK)\s*[:：]?$/i.test(l) && l.replace(CODE, '').replace(/[\s:：]/g, '') !== '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .slice(0, 500) || title;
    const codes = [...new Set(p.text.match(CODE) ?? [])].map((code) => ({ code }));
    data.posts.unshift({
      id: `post-${p.postId.slice(-10).toLowerCase()}`,
      category: guessCategory(p.text),
      title_zhHant: title,
      title_en: title,
      text_zhHant: text,
      text_en: text,
      publishedAt,
      ...(codes.length ? { codes } : {}),
      ...(p.link ? { link: p.link } : {}),
      postUrl: postUrl(p.postId),
      seen: today,
      until: addDays(publishedAt, codes.length ? 45 : 21),
      auto: true,
    });
    added.posts.push(title);
  }
  data.knownPostIds = [...known];
  return added;
}
