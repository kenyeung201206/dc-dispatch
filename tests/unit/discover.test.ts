import { describe, expect, it } from 'vitest';
import { DISCOVER_AFTER, MAX_FOLLOW, trackCreators, type CreatorConfig } from '../../pipeline/video/discover.ts';

const ch = (n: number) => `UC${String(n).padStart(22, '0')}`;
const vid = (id: string, channel: number, name = `Creator ${channel}`) => ({ id, channelName: name, channelUrl: `https://www.youtube.com/channel/${ch(channel)}` });
const now = new Date('2026-11-14T04:00:00Z');

describe('new Division 2 creators found by the searches', () => {
  it(`follows a channel once ${DISCOVER_AFTER} different videos of theirs were found`, () => {
    const c: CreatorConfig = { follow: [] };
    expect(trackCreators(c, [vid('a', 1), vid('a', 1), vid('b', 1)], now)).toEqual([]); // same video twice counts once
    expect(c.discovered?.[ch(1)]?.videos).toEqual(['a', 'b']);
    expect(trackCreators(c, [vid('c', 1)], now)).toEqual(['Creator 1']);
    expect(c.follow).toEqual([{ id: ch(1), name: 'Creator 1', official: false }]);
    expect(c.discovered?.[ch(1)]).toBeUndefined();
  });
  it('ignores channels already followed or official, and keeps the follow list capped', () => {
    const c: CreatorConfig = { follow: [{ id: ch(2), name: 'Followed', official: false }], channels: [{ id: ch(3), name: 'Ubisoft', official: true }] };
    trackCreators(c, [vid('x', 2), vid('y', 3), { ...vid('z', 4), official: true }], now);
    expect(c.discovered).toEqual({});
    const full: CreatorConfig = { follow: Array.from({ length: MAX_FOLLOW }, (_, i) => ({ id: ch(100 + i), name: `F${i}`, official: false })) };
    expect(trackCreators(full, ['p', 'q', 'r'].map((v) => vid(v, 5)), now)).toEqual([]);
    expect(full.follow).toHaveLength(MAX_FOLLOW);
  });
  it('forgets one-off channels after 30 days', () => {
    const c: CreatorConfig = { discovered: { [ch(6)]: { name: 'Once', videos: ['v'], firstSeen: '2026-10-01T00:00:00Z' } } };
    trackCreators(c, [], now);
    expect(c.discovered).toEqual({});
  });
});

describe('only the best 3–6 new videos per update (owner request 2026-11-14)', async () => {
  const { videoStories, thinVideo, MAX_VIDEO_STORIES } = await import('../../pipeline/video/intel-items.ts');
  const desc = 'This build guide covers the exotic chest, the new gear set bonuses, every talent you need for Heroic, and how to farm the parts.';
  const v = (id: string, ch: number, title: string, views = 100, description = desc) => ({
    id: `vid${id}`.padEnd(11, 'x'),
    title,
    channelName: `C${ch}`,
    channelUrl: `https://www.youtube.com/channel/C${ch}`,
    publishedAt: '2026-11-14T03:00:00.000Z',
    official: false,
    via: 'youtube-api' as const,
    search: true,
    views,
    description,
  });
  it('drops live streams and Shorts that have almost no description', () => {
    expect(thinVideo({ title: '🔴 LIVE Division 2 farming', description: 'join discord' })).toBe(true);
    expect(thinVideo({ title: 'BEST BUILD #shorts', description: '' })).toBe(true);
    expect(thinVideo({ title: '🔴 LIVE Division 2 farming', description: desc })).toBe(false);
    expect(thinVideo({ title: 'Lively build guide', description: '' })).toBe(false);
  });
  it('picks at most 6, one per creator, interesting topics and real descriptions first', () => {
    const pool = [
      ...Array.from({ length: 10 }, (_, i) => v(String(i), i, `Division 2 new exotic build ${i}`, 1000 + i)),
      v('dup', 0, 'Division 2 another build from the same creator', 99999),
      v('nodesc', 50, 'Division 2 exotic build with no description', 99999, ''),
    ];
    const picked = videoStories(pool as never, new Date('2026-11-14T05:00:00Z'));
    expect(MAX_VIDEO_STORIES).toBe(6);
    // All English: 1 English, topped up to 3 (80% Chinese rule, owner 2026-11-25).
    expect(picked).toHaveLength(3);
    expect(new Set(picked.map((p) => p.sourceName)).size).toBe(3);
    expect(picked.map((p) => p.title_orig)).not.toContain('Division 2 exotic build with no description');
  });
});

describe('favourites and readable titles (owner request 2026-11-15)', async () => {
  const { videoStories, readableTitle } = await import('../../pipeline/video/intel-items.ts');
  const long = 'Full walkthrough of the build: gear, talents, attributes, rotation and how to farm every piece in Heroic and Legendary.';
  const v = (id: string, ch: string, title: string, views: number, favourite = false) => ({
    id: id.padEnd(11, 'x'), title, channelName: ch, channelUrl: `https://www.youtube.com/channel/${ch}`,
    publishedAt: '2026-11-15T03:00:00.000Z', official: false, via: 'youtube-api' as const, search: true, views, description: long, favourite,
  });
  it("灰帽特工's new video is picked even when bigger channels have more views", () => {
    const pool = [
      ...Array.from({ length: 8 }, (_, i) => v(`zh${i}`, `big${i}`, `全境封鎖2 新奇特配裝 ${i}`, 90_000 + i)),
      v('fav', 'grayhat', '全境封鎖2 Y8S4 原型裝備校準全攻略', 50, true),
    ];
    expect(videoStories(pool as never, new Date('2026-11-15T05:00:00Z')).map((i) => i.videoId)).toContain('favxxxxxxxx');
  });
  it('keeps Chinese and English titles only', () => {
    expect(readableTitle('全境封鎖2 你也可以是控場之神')).toBe(true);
    expect(readableTitle('Division 2 August Exotic AR Is a LASER BEAM')).toBe(true);
    expect(readableTitle('LE NOUVEAU BUILD MÉTAS DU DLC ! Core Strength')).toBe(false);
    expect(readableTitle('😈💀 A TÚLÉLÉS ÉS A PUSZTÍTÁS MESTERE!')).toBe(false);
  });
});

describe('80% Chinese, 20% English (owner request 2026-11-25)', async () => {
  const { videoStories } = await import('../../pipeline/video/intel-items.ts');
  const long = 'Full walkthrough: gear, talents, attributes, rotation, and how to farm every piece in Heroic and Legendary difficulty.';
  const v = (id: string, title: string, views: number) => ({
    id: id.padEnd(11, 'x'), title, channelName: id, channelUrl: `https://www.youtube.com/channel/${id}`,
    publishedAt: '2026-11-25T03:00:00.000Z', official: false, via: 'youtube-api' as const, search: true, views, description: long,
  });
  const now = new Date('2026-11-25T05:00:00Z');
  const zh = (n: number) => Array.from({ length: n }, (_, i) => v(`zh${i}`, `全境封鎖2 奇特配裝攻略 ${i}`, 100 + i));
  const en = (n: number) => Array.from({ length: n }, (_, i) => v(`en${i}`, `Division 2 exotic build guide ${i}`, 90_000 + i));
  const langs = (items: { lang_orig: string }[]) => items.map((i) => (i.lang_orig.startsWith('zh') ? 'zh' : 'en')).sort().join('');
  it('plenty of Chinese: 5 Chinese + 1 English, even when English videos have far more views', () => {
    expect(langs(videoStories([...zh(8), ...en(8)] as never, now))).toBe('enzhzhzhzhzh');
  });
  it('few Chinese: English tops it up to 3, never more than needed', () => {
    expect(langs(videoStories([...zh(1), ...en(8)] as never, now))).toBe('enenzh');
    expect(langs(videoStories([...zh(3), ...en(8)] as never, now))).toBe('enzhzhzh');
  });
});

describe('Chinese creators are followed first, after 2 videos (owner request 2026-11-25)', () => {
  it('follows a Chinese channel after 2 videos, an English one only after 3', () => {
    const c: CreatorConfig = { follow: [] };
    const zhVid = (id: string) => ({ id, title: '全境封鎖2 配裝', channelName: '中文頻道', channelUrl: `https://www.youtube.com/channel/${ch(70)}` });
    const enVid = (id: string) => ({ id, title: 'Division 2 build', channelName: 'English', channelUrl: `https://www.youtube.com/channel/${ch(71)}` });
    expect(trackCreators(c, [zhVid('a'), zhVid('b'), enVid('c'), enVid('d')], now)).toEqual(['中文頻道']);
  });
});
