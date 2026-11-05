/**
 * Visit counter in Cloudflare KV (binding VIEWS, see wrangler.toml).
 * Counts a visit, not every page: the first signed-in page opens a visit; moving around the site (or Back)
 * doesn't count again until the reader has been away 30 minutes. The only thing stored in the browser is a
 * plain "1" flag cookie that expires; no IDs, no IPs, no per-person data.
 * Read-modify-write is fine at this site's size (a handful of readers).
 */
export interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
}
export interface ViewsEnv {
  VIEWS?: KV;
}

/** Day in Tokyo (the paper's time zone), YYYY-MM-DD. */
export const tokyoDay = (now: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));

const DAY_TTL = 40 * 86_400; // daily counters clean themselves up after 40 days

/** Is this request a page view worth counting? (HTML page, GET, not a prefetch or a bot preview) */
export function isPageView(request: Request): boolean {
  if (request.method !== 'GET') return false;
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
