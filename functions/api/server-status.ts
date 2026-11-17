/**
 * GET /api/server-status → { state: normal | scheduled | maintenance | unknown, start?, end?, url? } for the
 * banner badge. From 巴哈's 「關機維護公告」 threads (src/lib/server-status.ts): Ubisoft keeps its live status feed
 * private, so this follows the public announcements instead. The answer is cached at the edge for 5 minutes and
 * shared by all readers, so 巴哈 gets at most one board request (+ one post) every 5 minutes from us.
 */
import { BAHAMUT_URL, parseBahamutBoard } from '../../pipeline/sources/bahamut.ts';
import { newestMaintenance, parseBodyStart, parseDurationHours, statusAt, type ServerStatus } from '../../src/lib/server-status.ts';

const TTL = 300;
const UA = 'Mozilla/5.0 (compatible; DCDispatchBot/0.1; fan newspaper)';
const json = (body: ServerStatus, maxAge = TTL) =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${maxAge}` } });

async function get(url: string): Promise<string> {
  // Cloudflare only accepts redirect 'follow' or 'manual' (see 2026-11-10); 'manual' + res.ok refuses redirects.
  const res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'manual', signal: AbortSignal.timeout(8000), cf: { cacheTtl: TTL, cacheEverything: true } } as RequestInit);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (text.includes('系統異常')) throw new Error('巴哈 refused');
  return text.slice(0, 600_000);
}

export async function onRequestGet({ request }: { request: Request }): Promise<Response> {
  const cache = (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default;
  const key = new Request(new URL('/api/server-status', request.url).toString());
  const hit = await cache?.match(key);
  if (hit) return hit;
  let body: ServerStatus;
  try {
    const now = new Date();
    const m = newestMaintenance(parseBahamutBoard(await get(BAHAMUT_URL), now).map((i) => ({ title: i.title, url: i.url })));
    let hours: number | undefined;
    if (m && !m.done) {
      const post = (/<div class="c-article__content">([\s\S]*?)<\/article>/.exec(await get(m.url!))?.[1] ?? '').replace(/<[^>]+>/g, ' ');
      hours = parseDurationHours(post);
      // Title had only a date: the start time is in the post.
      if (m.timeKnown === false) m.start = parseBodyStart(post) ?? m.start;
    }
    body = statusAt(m, hours, now);
  } catch (err) {
    // Short reason, so the Cloudflare-runtime test can tell a code bug from 巴哈 being unreachable.
    body = { state: 'unknown', reason: String(err).slice(0, 120) };
  }
  const res = json(body, body.state === 'unknown' ? 60 : TTL);
  await cache?.put(key, res.clone());
  return res;
}
