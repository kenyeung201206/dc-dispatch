import { afterEach, describe, expect, it } from 'vitest';
import { onRequest } from '../../functions/_middleware.ts';
import { _resetFailures, makeToken, MAX_FAILURES, safeNext, verifyToken } from '../../functions/lib/auth.ts';

// Fake test values only.
const env = { SITE_PASSWORD: 'test-password-123', AUTH_SECRET: 'test-secret-0123456789abcdef' };
const NOW = Date.UTC(2026, 10, 4);
const BASE = 'https://dc-dispatch.pages.dev';
const ok = () => Promise.resolve(new Response('PAGE'));

const run = (path: string, init: RequestInit = {}, e: object = env) =>
  onRequest({ request: new Request(BASE + path, init), env: e, next: ok });
const login = (password: string, next = '/zh-hant/', ip = '1.2.3.4') =>
  run('/__login', {
    method: 'POST',
    body: new URLSearchParams({ password, next }),
    headers: { origin: BASE, host: 'dc-dispatch.pages.dev', 'cf-connecting-ip': ip, 'content-type': 'application/x-www-form-urlencoded' },
  });

afterEach(() => _resetFailures());

describe('site lock', () => {
  it('stays closed when secrets are missing (fail closed)', async () => {
    const res = await run('/en/', { headers: { accept: 'text/html' } }, {});
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain('PAGE');
  });

  it('sends visitors without a cookie to the password page, and refuses other files', async () => {
    const page = await run('/en/story/abc/?x=1', { headers: { accept: 'text/html' } });
    expect(page.status).toBe(303);
    expect(page.headers.get('location')).toBe('/__login?next=%2Fen%2Fstory%2Fabc%2F%3Fx%3D1');
    const json = await run('/api/live', { headers: { accept: 'application/json' } });
    expect(json.status).toBe(401);
    const img = await run('/pagefind/pagefind.js');
    expect(img.status).toBe(401);
  });

  it('right password sets a 30-day HttpOnly Secure cookie and returns to the page', async () => {
    const res = await login(env.SITE_PASSWORD);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/zh-hant/');
    const cookie = res.headers.get('set-cookie')!;
    expect(cookie).toMatch(/^dcd_auth=v1\.\d+\.[0-9a-f]{64}; Path=\/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure$/);
    const token = cookie.split(';')[0]!;
    const page = await run('/en/', { headers: { cookie: token } });
    expect(await page.text()).toBe('PAGE');
  });

  it('wrong password is refused, and repeated guesses lock out', async () => {
    const res = await login('nope');
    expect(res.status).toBe(401);
    expect(res.headers.get('set-cookie')).toBeNull();
    for (let i = 1; i < MAX_FAILURES; i++) await login('nope');
    const locked = await login(env.SITE_PASSWORD);
    expect(locked.status).toBe(429);
  }, 20_000);

  it('rejects forged, expired or old-password cookies', async () => {
    const good = await makeToken(env, NOW);
    expect(await verifyToken(env, good, NOW)).toBe(true);
    expect(await verifyToken(env, good.replace(/.$/, (c) => (c === '0' ? '1' : '0')), NOW)).toBe(false);
    expect(await verifyToken(env, good, NOW + 31 * 86_400_000)).toBe(false);
    expect(await verifyToken({ ...env, SITE_PASSWORD: 'changed' }, good, NOW)).toBe(false);
    expect(await verifyToken(env, 'v1.9999999999.' + 'a'.repeat(64), NOW)).toBe(false);
  });

  it('never redirects to another site after sign-in', () => {
    expect(safeNext('//evil.example')).toBe('/');
    expect(safeNext('https://evil.example')).toBe('/');
    expect(safeNext('/\\evil.example')).toBe('/');
    expect(safeNext('/en/watch/')).toBe('/en/watch/');
  });

  it('rejects a login form posted from another site', async () => {
    const res = await run('/__login', {
      method: 'POST',
      body: new URLSearchParams({ password: env.SITE_PASSWORD }),
      headers: { origin: 'https://evil.example', 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(res.status).toBe(403);
  });

  it('sign out clears the cookie', async () => {
    const res = await run('/__logout');
    expect(res.headers.get('set-cookie')).toMatch(/dcd_auth=; Path=\/; Max-Age=0/);
  });
});

describe('origin check uses the Host the browser used', () => {
  it('accepts a same-host form even if the internal URL differs (dev/proxy)', async () => {
    const res = await onRequest({
      request: new Request('http://127.0.0.1:8788/__login', {
        method: 'POST',
        body: new URLSearchParams({ password: env.SITE_PASSWORD, next: '/en/' }),
        headers: { origin: 'http://localhost:8788', host: 'localhost:8788', 'content-type': 'application/x-www-form-urlencoded' },
      }),
      env,
      next: ok,
    });
    expect(res.status).toBe(303);
  });
});

describe('home-screen app files', () => {
  it('icons and the manifest load without signing in (phones fetch them cookie-less)', async () => {
    for (const p of ['/manifest.webmanifest', '/icons/apple-touch-icon.png', '/icons/icon-512.png', '/icons/maskable-512.png', '/apple-touch-icon.png']) {
      expect((await run(p)).status, p).toBe(200);
    }
  });

  it('only those exact files: neighbours, tricks and POSTs stay locked', async () => {
    for (const p of ['/icons/', '/icons/../en/', '/icons/secret.png', '/manifest.webmanifest.bak', '/en/manifest.webmanifest', '/data/editions/2026-11-04.json']) {
      expect((await run(p)).status, p).toBe(401);
    }
    expect((await run('/manifest.webmanifest', { method: 'POST' })).status).toBe(401);
  });
});
