/**
 * Runs before EVERY request (pages, pictures, search index, /api/live): no valid sign-in cookie ⇒ password page.
 * See functions/lib/auth.ts. Secrets: SITE_PASSWORD, AUTH_SECRET (Cloudflare Pages project settings).
 */
import {
  type AuthEnv,
  clearCookieHeader,
  clearFailures,
  configured,
  COOKIE,
  cookieHeader,
  isLockedOut,
  LOGIN_PATH,
  LOGOUT_PATH,
  loginPage,
  makeToken,
  readCookie,
  recordFailure,
  safeEqual,
  safeNext,
  verifyToken,
} from './lib/auth.ts';
import { countView, isPageView, VISIT_COOKIE, visitCookieHeader, type ViewsEnv } from './lib/views.ts';

interface Ctx {
  request: Request;
  env: AuthEnv & ViewsEnv;
  next: () => Promise<Response>;
  waitUntil?: (p: Promise<unknown>) => void;
}

/** Exact files only (no folders, no wildcards), so nothing else slips past the lock. */
const APP_SHELL = new Set([
  '/manifest.webmanifest',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/favicon-32.png',
  '/apple-touch-icon.png',
]);
export const isAppShellAsset = (path: string) => APP_SHELL.has(path);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const redirect = (to: string, extra: Record<string, string> = {}) =>
  new Response(null, { status: 303, headers: { location: to, 'cache-control': 'no-store', ...extra } });

export async function onRequest({ request, env, next, waitUntil }: Ctx): Promise<Response> {
  const url = new URL(request.url);
  const secure = url.protocol === 'https:';
  if (!configured(env)) return loginPage('unconfigured', '/', 503);
  const e = env as Required<AuthEnv>;
  const now = Date.now();

  // Home-screen icon + app manifest: phones fetch these without the sign-in cookie. They hold no news content.
  if (isAppShellAsset(url.pathname) && (request.method === 'GET' || request.method === 'HEAD')) return next();

  if (url.pathname === LOGOUT_PATH)return redirect(LOGIN_PATH, { 'set-cookie': clearCookieHeader(secure) });

  if (url.pathname === LOGIN_PATH) {
    if (request.method === 'POST') {
      // Only accept the form from our own pages.
      // Compare hosts (the Host header is what the browser actually used; request.url can differ behind proxies/dev).
      const origin = request.headers.get('origin');
      if (origin && origin !== 'null') {
        let host = '';
        try {
          host = new URL(origin).host;
        } catch {}
        if (host !== (request.headers.get('host') ?? url.host)) return new Response('Forbidden', { status: 403 });
      }
      const ip = request.headers.get('cf-connecting-ip') ?? 'local';
      const form = await request.formData();
      const nextPath = safeNext(String(form.get('next') ?? '/'));
      if (isLockedOut(ip, now)) return loginPage('locked', nextPath, 429);
      const password = String(form.get('password') ?? '');
      if (password && (await safeEqual(password, e.SITE_PASSWORD, e.AUTH_SECRET))) {
        clearFailures(ip);
        return redirect(nextPath, { 'set-cookie': cookieHeader(await makeToken(e, now), secure) });
      }
      recordFailure(ip, now);
      await sleep(1000); // slows down guessing
      return loginPage(isLockedOut(ip, now) ? 'locked' : 'wrong', nextPath, 401);
    }
    const nextPath = safeNext(url.searchParams.get('next'));
    if (await verifyToken(e, readCookie(request.headers.get('cookie'), COOKIE), now)) return redirect(nextPath);
    return loginPage('ask', nextPath);
  }

  if (await verifyToken(e, readCookie(request.headers.get('cookie'), COOKIE), now)) {
    if (!isPageView(request)) return next();
    // Visit counter: only the first page of a visit counts (after the response, so pages never wait on it).
    const inVisit = readCookie(request.headers.get('cookie'), VISIT_COOKIE) === '1';
    if (!inVisit && env.VIEWS && waitUntil) waitUntil(countView(env.VIEWS, now).catch(() => {}));
    const res = await next();
    const out = new Response(res.body, res);
    out.headers.append('set-cookie', visitCookieHeader(secure));
    return out;
  }

  // Not signed in: send page visits to the password page; refuse everything else.
  const wantsPage = request.method === 'GET' && (request.headers.get('accept') ?? '').includes('text/html');
  if (wantsPage) return redirect(`${LOGIN_PATH}?next=${encodeURIComponent(url.pathname + url.search)}`);
  return new Response('Sign-in required', { status: 401, headers: { 'cache-control': 'no-store' } });
}
