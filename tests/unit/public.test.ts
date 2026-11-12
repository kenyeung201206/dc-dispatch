import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pagePaths, sitemapXml } from '../../scripts/sitemap.ts';
import { _resetLive, onRequestGet } from '../../functions/api/live.ts';
import { _reset } from '../../functions/lib/twitch.ts';
import { onRequest } from '../../functions/_middleware.ts';
import { onRequestGet as views } from '../../functions/api/views.ts';

describe('sitemap', () => {
  let dir = '';
  afterEach(async () => dir && rm(dir, { recursive: true, force: true }));

  it('lists built pages but skips noindex ones', async () => {
    dir = await mkdtemp(join(tmpdir(), 'dcd-sitemap-'));
    const page = async (p: string, html: string) => {
      await mkdir(join(dir, p), { recursive: true });
      await writeFile(join(dir, p, 'index.html'), html);
    };
    await page('zh-hant', '<html></html>');
    await page('zh-hant/story/abc', '<html></html>');
    await page('styleguide', '<meta name="robots" content="noindex" />');
    expect(await pagePaths(dir)).toEqual(['/zh-hant/', '/zh-hant/story/abc/']);
    expect(sitemapXml(['/zh-hant/'])).toContain('<loc>https://dc-dispatch.pages.dev/zh-hant/</loc>');
  });
});

describe('/api/live on a public site', () => {
  afterEach(() => {
    _resetLive();
    _reset();
    vi.unstubAllGlobals();
  });

  it('asks Twitch at most once per 5 minutes, however many readers', async () => {
    const twitch = vi.fn(async (url: string) => {
      if (url.includes('oauth2/token')) return new Response(JSON.stringify({ access_token: 'x', expires_in: 3600 }));
      if (url.includes('games?')) return new Response(JSON.stringify({ data: [{ id: '1' }] }));
      return new Response(JSON.stringify({ data: [] }));
    });
    vi.stubGlobal('fetch', twitch);
    const env = { TWITCH_CLIENT_ID: 'id', TWITCH_CLIENT_SECRET: 'secret' };
    const t0 = Date.now();
    const first = await onRequestGet({ env }, t0);
    const calls = twitch.mock.calls.length;
    expect(first.headers.get('cache-control')).toBe('public, max-age=300');
    for (let i = 0; i < 20; i++) await onRequestGet({ env }, t0 + 60_000);
    expect(twitch.mock.calls.length).toBe(calls);
    expect((await onRequestGet({ env }, t0 + 60_000)).headers.get('cache-control')).toBe('public, max-age=240');
    await onRequestGet({ env }, t0 + 5 * 60_000);
    expect(twitch.mock.calls.length).toBeGreaterThan(calls);
  });
});

describe('built-in visit counter on the public site', () => {
  const BASE = 'https://dc-dispatch.pages.dev';
  const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const ok = () => Promise.resolve(new Response('PAGE'));
  const store = () => {
    const m = new Map<string, string>();
    return { m, kv: { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => void m.set(k, v) } };
  };

  it('opens pages without any password and counts a visit once', async () => {
    const { m, kv } = store();
    const jobs: Promise<unknown>[] = [];
    let visit = '';
    const open = async (path: string) => {
      const res = await onRequest({
        request: new Request(BASE + path, { headers: { accept: 'text/html', 'user-agent': PHONE, cookie: visit } }),
        env: { VIEWS: kv },
        next: ok,
        waitUntil: (p) => void jobs.push(p),
      });
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('PAGE');
      visit = (res.headers.get('set-cookie') ?? '').split(';')[0]!;
    };
    await open('/zh-hant/');
    await open('/zh-hant/story/x/');
    await open('/zh-hant/');
    await Promise.all(jobs);
    expect(m.get('total')).toBe('1');
    expect(visit).toBe('dcd_visit=1');
    visit = ''; // 30 minutes later
    await open('/en/');
    await Promise.all(jobs);
    expect(m.get('total')).toBe('2');
    expect((await (await views({ env: { VIEWS: kv } })).json())).toMatchObject({ status: 'ok', total: 2 });
  });

  it('does not count robots, scripts, prefetches or API calls', async () => {
    const { m, kv } = store();
    const jobs: Promise<unknown>[] = [];
    const go = (path: string, headers: Record<string, string>) =>
      onRequest({ request: new Request(BASE + path, { headers }), env: { VIEWS: kv }, next: ok, waitUntil: (p) => void jobs.push(p) });
    const html = { accept: 'text/html' };
    for (const ua of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/116 Safari/537.36',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
      'curl/8.5.0',
      '',
    ])
      await go('/zh-hant/', { ...html, 'user-agent': ua });
    await go('/zh-hant/', { ...html, 'user-agent': PHONE, 'sec-purpose': 'prefetch' });
    await go('/api/views', { accept: 'application/json', 'user-agent': PHONE });
    await Promise.all(jobs);
    expect(m.get('total')).toBeUndefined();
  });

  it('pages still open when the counter storage is missing or broken', async () => {
    const broken = { get: async () => { throw new Error('down'); }, put: async () => {} };
    const req = () => new Request(BASE + '/zh-hant/', { headers: { accept: 'text/html', 'user-agent': PHONE } });
    expect((await onRequest({ request: req(), env: { VIEWS: broken }, next: ok, waitUntil: () => {} })).status).toBe(200);
    expect((await onRequest({ request: req(), env: {}, next: ok })).status).toBe(200);
  });
});
