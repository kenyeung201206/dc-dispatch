import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dayStart, mergeVisits, paperDay, parseVisitsResponse, totalVisits, updateVisits } from '../../pipeline/visits.ts';
import { assertAllowedUrl } from '../../pipeline/http.ts';
import { VisitsSchema } from '../../src/schema/item.ts';
import { visitsLine } from '../../src/lib/visits.ts';
import { pagePaths, sitemapXml } from '../../scripts/sitemap.ts';
import { _resetLive, onRequestGet } from '../../functions/api/live.ts';
import { _reset } from '../../functions/lib/twitch.ts';

// 2026-11-12 10:30 Tokyo = 01:30 UTC.
const now = new Date('2026-11-12T01:30:00Z');
const empty = VisitsSchema.parse({});
const answer = (rows: [string, number][]) => ({
  data: { viewer: { accounts: [{ rumPageloadEventsAdaptiveGroups: rows.map(([h, v]) => ({ sum: { visits: v }, dimensions: { datetimeHour: h } })) }] } },
  errors: null,
});

describe('visitor number (Cloudflare Web Analytics)', () => {
  it('counts days in Tokyo time', () => {
    expect(paperDay(now)).toBe('2026-11-12');
    expect(dayStart(now, 2).toISOString()).toBe('2026-11-09T15:00:00.000Z'); // 2026-11-10 00:00 Tokyo
  });

  it('buckets hours into Tokyo days and replaces only the days it asked about', () => {
    const prev = { ...empty, carriedOver: 100, days: { '2026-11-08': 7, '2026-11-10': 999 } };
    const rows = parseVisitsResponse(
      answer([
        ['2026-11-10T14:00:00Z', 3], // 23:00 Tokyo, 11-10
        ['2026-11-10T15:00:00Z', 4], // 00:00 Tokyo, 11-11
        ['2026-11-12T00:00:00Z', 5], // 09:00 Tokyo, 11-12
      ]),
    );
    const v = mergeVisits(prev, rows, dayStart(now, 2), now);
    expect(v.days).toEqual({ '2026-11-08': 7, '2026-11-10': 3, '2026-11-11': 4, '2026-11-12': 5 });
    expect(totalVisits(v)).toBe(119);
    expect(v.updatedAt).toBe(now.toISOString());
    expect(() => VisitsSchema.parse(v)).not.toThrow();
  });

  it('reports Cloudflare errors instead of saving zeros', () => {
    expect(() => parseVisitsResponse({ errors: [{ message: 'not authorized' }] })).toThrow(/not authorized/);
    expect(() => parseVisitsResponse({ data: { viewer: { accounts: [] } } })).toThrow(/no account/);
  });

  it('does nothing without its secrets, and sends the token only to Cloudflare', async () => {
    const f = vi.fn();
    expect(await updateVisits(empty, {}, now, f)).toBeUndefined();
    expect(f).not.toHaveBeenCalled();

    const g = vi.fn(async () => new Response(JSON.stringify(answer([['2026-11-12T00:00:00Z', 2]]))));
    const v = await updateVisits(empty, { CF_ANALYTICS_TOKEN: 't0k', CLOUDFLARE_ACCOUNT_ID: 'acc', CF_WEB_ANALYTICS_SITE_TAG: 'tag' }, now, g as unknown as typeof fetch);
    expect(v?.days['2026-11-12']).toBe(2);
    const [url, init] = g.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.href).toBe('https://api.cloudflare.com/client/v4/graphql');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer t0k');
    expect(JSON.parse(String(init.body)).variables).toMatchObject({ accountTag: 'acc', siteTag: 'tag' });
    expect(() => assertAllowedUrl('https://api.cloudflare.com/client/v4/graphql')).not.toThrow();
  });

  it('formats the masthead line, hidden until there are counts', () => {
    expect(visitsLine('zh-hant', '{total} 次（今日 {today}）', empty, '2026-11-12')).toBeNull();
    const v = { ...empty, updatedAt: now.toISOString(), carriedOver: 1200, days: { '2026-11-11': 30, '2026-11-12': 12 } };
    expect(visitsLine('zh-hant', '{total} 次（今日 {today}）', v, '2026-11-12')).toBe('1,242 次（今日 12）');
    expect(visitsLine('en', '{total} ({today} today)', v, '2026-11-13')).toBe('1,242 (0 today)');
  });
});

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
