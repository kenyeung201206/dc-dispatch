import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cleanTitle, eventsFromArticle, guidesFromPicks, guidesFromVideos, liveGuides, mergeEvents, untilFor } from '../../pipeline/guides.ts';
import { parseUbisoftNews } from '../../pipeline/sources/ubisoft.ts';
import { CreatorPostsSchema, GameEventLogSchema, ItemSchema } from '../../src/schema/item.ts';
import { creatorPostStories } from '../../pipeline/creator-posts.ts';

const events = GameEventLogSchema.parse(JSON.parse(readFileSync('tests/fixtures/data/events.json', 'utf8'))).events;

describe('guide expiry', () => {
  it('ties event guides to the event end, others to 60 days', () => {
    expect(untilFor('速刷2026血月活動鑰匙 機制＆神點位分享', '2026-10-20T00:00:00Z', events)).toEqual({ until: '2026-11-03', eventId: 'red-moon-unleashed-2026' });
    expect(untilFor('Shepherd event fast projects', '2026-11-18T00:00:00Z', events).until).toBe('2026-11-26');
    expect(untilFor('中央公園隱藏獵人彩蛋', '2026-11-04T00:00:00Z', events)).toEqual({ until: '2027-01-03' });
  });

  it('removes guides the day after their event ends', () => {
    const g = guidesFromVideos([{ id: 'NsVIcVazgNU', title: '速刷2026血月活動鑰匙 #全境封鎖', publishedAt: '2026-10-20T00:00:00.000Z', official: false, via: 'youtube-api', channelName: '灰帽特工', channelUrl: 'https://www.youtube.com/channel/UCJ2qGCBwyN8d2l9aoWkyShw' }], events, new Date('2026-11-01T00:00:00Z'));
    expect(g[0]!.title).toBe('速刷2026血月活動鑰匙');
    expect(liveGuides(g, new Date('2026-11-03T12:00:00+09:00'))).toHaveLength(1); // last day of the event
    expect(liveGuides(g, new Date('2026-11-04T00:30:00+09:00'))).toHaveLength(0); // day after
  });

  it('drops video guides not re-checked within 30 days', () => {
    const [g] = guidesFromVideos([{ id: 'aaaaaaaaaaa', title: 'x', publishedAt: '2026-11-01T00:00:00.000Z', official: false, via: 'youtube-api' }], events, new Date('2026-11-01T00:00:00Z'));
    expect(liveGuides([{ ...g!, until: '2027-12-31' }], new Date('2026-12-15T00:00:00Z'))).toHaveLength(0);
  });

  it('builds editor picks with their own until date or event', () => {
    const [video, post] = guidesFromPicks(
      [
        { kind: 'video', videoId: 'I2bM6jujjv0', title: '入手最炫面具 #全境封鎖', channelName: '灰帽特工', channelUrl: 'https://www.youtube.com/@x', added: '2026-11-04' },
        { kind: 'post', url: 'https://www.youtube.com/post/abc', title: 'Shepherd 活動攻略', channelName: '灰帽特工', channelUrl: 'https://www.youtube.com/@x', added: '2026-11-18', summary_zhHant: '我們的摘要' },
      ],
      events,
    );
    expect(video).toMatchObject({ id: 'yt-I2bM6jujjv0', until: '2027-01-03', addedBy: 'editor', title: '入手最炫面具' });
    expect(post).toMatchObject({ kind: 'post', until: '2026-11-26', eventId: 'shepherd-2026-11' });
  });
});

describe('events from Ubisoft notes', () => {
  it('reads "EVENT … From November 17 to November 26" and does not duplicate curated events', () => {
    const ubi = parseUbisoftNews(readFileSync('tests/fixtures/sources/ubisoft-en.html', 'utf8'), 'ubisoft-en');
    const auto = ubi.flatMap(eventsFromArticle);
    expect(auto.some((e) => e.start === '2026-11-17' && e.end === '2026-11-26')).toBe(true);
    expect(mergeEvents(events, auto).filter((e) => e.end === '2026-11-26')).toHaveLength(1);
    expect(mergeEvents([], auto).length).toBe(auto.length);
  });

  it('strips hashtags from titles', () => {
    expect(cleanTitle('最高難度全流程 #全境封鎖 #thedivision2')).toBe('最高難度全流程');
  });
});

describe('灰帽特工 curated posts', () => {
  const file = JSON.parse(readFileSync('tests/fixtures/data/creator-posts.json', 'utf8'));

  it('the data file is valid and the mission series is complete', () => {
    const data = CreatorPostsSchema.parse(file);
    const s = data.series.find((x) => x.id === 'y8s3-manhunt-scouts')!;
    expect(s.entries.map((e) => e.n).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    for (const e of s.entries) expect(e.steps_en).toHaveLength(e.steps_zhHant.length);
  });

  it('only recent, unexpired posts become stories, in their own section, never official', () => {
    const items = creatorPostStories(file, new Date('2026-11-05T00:00:00Z'));
    expect(items.map((i) => i.category).sort()).toEqual(['community', 'updates']);
    for (const i of items) {
      expect(ItemSchema.safeParse(i).success).toBe(true);
      expect(i.confidence).toBe('community');
      expect(i.headline_en).not.toBe('pending');
    }
    expect(creatorPostStories(file, new Date('2026-11-20T00:00:00Z'))).toHaveLength(0);
  });
});
