import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { _reset, getLive } from '../../functions/lib/twitch.ts';
import { buildVideos } from '../../pipeline/video/build.ts';
import { pairRegional, parseDuration, parseUbisoftVideos, rowFor } from '../../pipeline/video/videos.ts';
import { fetchChannelVideos } from '../../pipeline/video/youtube.ts';
import type { Video } from '../../src/schema/item.ts';

const NOW = new Date('2026-11-04T06:00:00+09:00');
const fx = (f: string) => readFileSync(`tests/fixtures/sources/${f}`, 'utf8');

describe('video helpers', () => {
  it('reads official videos from the Ubisoft page and pairs regional uploads', () => {
    const en = parseUbisoftVideos(fx('ubisoft-en.html'));
    const zh = parseUbisoftVideos(fx('ubisoft-zh-tw.html'));
    expect(en.length).toBeGreaterThan(0);
    expect(en.every((v) => /^[A-Za-z0-9_-]{11}$/.test(v.id) && v.official)).toBe(true);
    const paired = pairRegional(en, zh);
    expect(paired.some((v) => v.idZh && v.idZh !== v.id)).toBe(true);
  });
  it('sorts videos into rows and parses durations', () => {
    expect(rowFor('Echoes of Central Park - Launch Trailer')).toBe('trailers');
    expect(rowFor('TU Y8S3.3 patch notes explained')).toBe('patch-breakdowns');
    expect(rowFor('The ONLY 5 Builds You Need')).toBe('build-guides');
    expect(rowFor('Behind the scenes')).toBe('more');
    expect(parseDuration('PT1H2M3S')).toBe(3723);
    expect(parseDuration('PT45S')).toBe(45);
    expect(parseDuration('P1D')).toBeUndefined();
  });
});

describe('buildVideos', () => {
  const prev = (id: string, daysAgo: number): Video => ({
    id,
    title: 'Old video',
    channelName: 'Ubisoft',
    channelUrl: 'https://www.youtube.com/@Ubisoft',
    publishedAt: '2026-10-01T00:00:00.000Z',
    official: true,
    row: 'more',
    checkedAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
    via: 'ubisoft-page',
  });

  it('only lists videos that pass the embeddable check, and drops data older than 30 days', async () => {
    const html = fx('ubisoft-en.html');
    const ids = parseUbisoftVideos(html).map((v) => v.id);
    const blocked = ids[0]!;
    const check = vi.fn(async (id: string) =>
      id === blocked ? { ok: false as const } : { ok: true as const, title: 't', channelName: 'Ubisoft', channelUrl: 'https://www.youtube.com/@Ubisoft' },
    );
    const out = await buildVideos({
      enHtml: html,
      previous: [prev('AAAAAAAAAAA', 5), prev('BBBBBBBBBBB', 31), { ...prev(blocked, 1) }],
      channels: [],
      now: NOW,
      dryRun: false,
      check,
    });
    const outIds = out.map((v) => v.id);
    expect(outIds).not.toContain(blocked); // rejected today, even though cached yesterday
    expect(outIds).toContain('AAAAAAAAAAA'); // still within 30 days
    expect(outIds).not.toContain('BBBBBBBBBBB'); // older than 30 days → deleted
    expect(out.every((v) => v.checkedAt)).toBe(true);
  });
});

describe('fetchChannelVideos (YouTube Data API, mocked)', () => {
  const ch = [{ id: 'UCyRKkittAyXHhjZxqC49cxg', name: 'GCROCK', official: false }];
  const video = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    snippet: { title: 'The Division 2 build guide', channelTitle: 'GCROCK', channelId: ch[0]!.id, publishedAt: '2026-11-01T00:00:00Z' },
    status: { embeddable: true, privacyStatus: 'public', madeForKids: false },
    contentDetails: { duration: 'PT12M' },
    ...over,
  });

  it('skips everything without a key', async () => {
    const get = vi.fn();
    expect(await fetchChannelVideos(ch, undefined, NOW, get)).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });

  it('keeps only public, embeddable, not-for-kids Division videos', async () => {
    const get = vi.fn(async (url: string) => {
      if (url.includes('playlistItems')) {
        expect(url).toContain('playlistId=UUyRKkittAyXHhjZxqC49cxg');
        return JSON.stringify({ items: ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc', 'ddddddddddd', 'eeeeeeeeeee'].map((videoId) => ({ contentDetails: { videoId } })) });
      }
      return JSON.stringify({
        items: [
          video('aaaaaaaaaaa'),
          video('bbbbbbbbbbb', { status: { embeddable: false, privacyStatus: 'public' } }),
          video('ccccccccccc', { status: { embeddable: true, privacyStatus: 'public', madeForKids: true } }),
          video('ddddddddddd', { snippet: { title: 'Some other game', channelTitle: 'GCROCK', channelId: ch[0]!.id, publishedAt: '2026-11-01T00:00:00Z' } }),
          video('eeeeeeeeeee', { status: { embeddable: true, privacyStatus: 'unlisted' } }),
        ],
      });
    });
    const out = await fetchChannelVideos(ch, 'fake-test-key', NOW, get);
    expect(out.map((v) => v.id)).toEqual(['aaaaaaaaaaa']);
    expect(out[0]).toMatchObject({ durationSec: 720, verified: true, via: 'youtube-api' });
  });

  it('never logs the API key', async () => {
    const logs: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((s: string) => void logs.push(s));
    const get = vi.fn(async () => {
      throw new Error('HTTP 403 for https://www.googleapis.com/youtube/v3/playlistItems?key=fake-test-key');
    });
    await fetchChannelVideos(ch, 'fake-test-key', NOW, get);
    spy.mockRestore();
    expect(logs.join('\n')).not.toContain('fake-test-key');
  });
});

describe('Twitch live lookup (mocked Helix)', () => {
  afterEach(() => _reset());
  const env = { TWITCH_CLIENT_ID: 'fake-id', TWITCH_CLIENT_SECRET: 'fake-secret' };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  function helix(streams: unknown[], clips: unknown[] = []) {
    return vi.fn(async (url: string) => {
      if (url.startsWith('https://id.twitch.tv/')) return json({ access_token: 'tok', expires_in: 3600 });
      if (url.includes('/helix/games')) return json({ data: [{ id: '123' }] });
      if (url.includes('/helix/streams')) return json({ data: streams });
      if (url.includes('/helix/clips')) return json({ data: clips });
      return json({}, 404);
    });
  }

  it('reports unconfigured without credentials', async () => {
    expect((await getLive({})).status).toBe('unconfigured');
  });

  it('returns live streams, sanitising thumbnails and logins', async () => {
    const f = helix([
      { user_login: 'agent_one', user_name: 'Agent One', title: 'DZ runs', viewer_count: 42, thumbnail_url: 'https://static-cdn.jtvnw.net/previews-ttv/live_user_agent_one-{width}x{height}.jpg' },
      { user_login: 'bad login!', user_name: 'x', title: 'x', viewer_count: 1, thumbnail_url: 'https://static-cdn.jtvnw.net/x.jpg' },
      { user_login: 'evilthumb', user_name: 'x', title: 'x', viewer_count: 1, thumbnail_url: 'https://evil.example/x.jpg' },
    ]);
    const r = await getLive(env, f as never, NOW.getTime());
    expect(r.status).toBe('live');
    expect(r.streams).toHaveLength(1);
    expect(r.streams[0]!.thumbnail).toContain('440x248');
  });

  it('returns offline when nobody is streaming, error when Twitch fails', async () => {
    expect((await getLive(env, helix([]) as never, NOW.getTime())).status).toBe('offline');
    _reset();
    const failing = vi.fn(async () => json({}, 500));
    expect((await getLive(env, failing as never, NOW.getTime())).status).toBe('error');
  });
});
