/**
 * Runs before every request. The site is public: this only counts visits (functions/lib/views.ts).
 * Counting happens after the page is sent, so pages never wait on it, and a broken counter never breaks a page.
 */
import { countView, isPageView, VISIT_COOKIE, visitCookieHeader, type ViewsEnv } from './lib/views.ts';

interface Ctx {
  request: Request;
  env: ViewsEnv;
  next: () => Promise<Response>;
  waitUntil?: (p: Promise<unknown>) => void;
}

const readCookie = (header: string | null, name: string) =>
  (header ?? '')
    .split(/;\s*/)
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);

export async function onRequest({ request, env, next, waitUntil }: Ctx): Promise<Response> {
  if (!isPageView(request)) return next();
  const now = Date.now();
  const inVisit = readCookie(request.headers.get('cookie'), VISIT_COOKIE) === '1';
  if (!inVisit && env.VIEWS && waitUntil) waitUntil(countView(env.VIEWS, now).catch(() => {}));
  const res = await next();
  const out = new Response(res.body, res);
  out.headers.append('set-cookie', visitCookieHeader(new URL(request.url).protocol === 'https:'));
  return out;
}
