/**
 * Visit counter in Cloudflare KV (binding VIEWS, see wrangler.toml).
 * Counts a visit, not every page: the first page opens a visit; moving around the site (or Back)
 * doesn't count again until the reader has been away 30 minutes. The only thing stored in the browser is a
 * plain "1" flag cookie that expires; no IDs, no IPs, no per-person data. Search-engine and link-preview
 * robots are not counted (they keep no cookies, so every page they read would look like a new visit).
 * Each visit is 2 saves to KV; the free plan allows 1,000 saves a day, so the number stops rising after about
 * 500 visits in a day (pages keep working). Read-modify-write can miss a count when two visits land at once.
 */
export interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}
export interface ViewsEnv {
  VIEWS?: KV;
}

/** Day in Taiwan/Hong Kong time (UTC+8, the paper's time zone), YYYY-MM-DD. */
export const tokyoDay = (now: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));

const DAY_TTL = 40 * 86_400; // daily counters clean themselves up after 40 days

/** Search engines, link previews (Facebook, LINE, Discord…), uptime checkers and scripts. */
export const ROBOT_UA = /bot\b|bot\/|crawl|spider|slurp|facebookexternalhit|facebookcatalog|meta-externalagent|embedly|preview|whatsapp|telegram|line-poker|skype|vkshare|pinterest|headless|lighthouse|pagespeed|uptime|monitor|curl|wget|python|node-fetch|axios|go-http|java\/|okhttp|httpclient/i;

/** Is this request a page view worth counting? (HTML page, GET, not a prefetch or a robot) */
export function isPageView(request: Request): boolean {
  if (request.method !== 'GET') return false;
  const ua = request.headers.get('user-agent') ?? '';
  if (!ua || ROBOT_UA.test(ua)) return false;
  if (!(request.headers.get('accept') ?? '').includes('text/html')) return false;
  const purpose = request.headers.get('sec-purpose') ?? request.headers.get('purpose') ?? '';
  if (/prefetch|prerender/i.test(purpose)) return false;
  const path = new URL(request.url).pathname;
  return !path.startsWith('/__') && !path.startsWith('/api/');
}

export const VISIT_COOKIE = 'dcd_visit';
export const VISIT_SECONDS = 30 * 60;
/** Refreshed on every page, so a visit lasts until 30 minutes without opening a page. */
export const visitCookieHeader = (secure: boolean) =>
  `${VISIT_COOKIE}=1; Path=/; Max-Age=${VISIT_SECONDS}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;

const num = (v: string | null) => (v && /^\d+$/.test(v) ? Number(v) : 0);

export async function countView(kv: KV, now: number): Promise<void> {
  const dayKey = `day:${tokyoDay(now)}`;
  const [total, today] = await Promise.all([kv.get('total'), kv.get(dayKey)]);
  await Promise.all([kv.put('total', String(num(total) + 1)), kv.put(dayKey, String(num(today) + 1), { expirationTtl: DAY_TTL })]);
}

export async function readViews(kv: KV, now: number): Promise<{ total: number; today: number }> {
  const [total, today] = await Promise.all([kv.get('total'), kv.get(`day:${tokyoDay(now)}`)]);
  return { total: num(total), today: num(today) };
}
