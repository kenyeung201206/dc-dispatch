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
