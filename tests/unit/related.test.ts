import { describe, expect, it } from 'vitest';
import { relatedChineseVideos, topicsOf } from '../../src/lib/related-videos.ts';
import type { Video } from '../../src/schema/item.ts';

const vid = (id: string, title: string, publishedAt = '2026-11-04T00:00:00Z'): Video => ({
  id: id.padEnd(11, 'x'),
  title,
  channelName: 'c',
  channelUrl: 'https://www.youtube.com/@c',
  publishedAt,
  official: false,
  row: 'more',
  rumour: false,
  checkedAt: publishedAt,
  via: 'youtube-search',
});
const pool = [
  { video: vid('park', '全境封鎖2 中央公園 直播'), guide: false },
  { video: vid('mask', '中央公園隱藏獵人 面具攻略'), guide: true },
  { video: vid('bear', '全境封锁2：猎捕大师本奇特：全副武装！'), guide: false },
  { video: vid('hunt', '最終獵捕！機場精通'), guide: false },
];
const story = (title: string, summary = '') => ({ title_orig: title, headline_en: title, summary_en: summary });

describe('related Chinese videos', () => {
  it('reads topics from English text', () => {
    expect(topicsOf('How to get the Ratel exotic in Central Park').map((t) => t.id)).toEqual(['ratel', 'central-park', 'exotic']);
  });

  it('a specific topic beats a broad one, including Simplified Chinese titles', () => {
    const out = relatedChineseVideos(story('New Exotic Loaded For Bear build'), pool).map((v) => v.id);
    expect(out[0]).toBe('bear'.padEnd(11, 'x'));
    expect(out).not.toContain('park'.padEnd(11, 'x'));
  });

  it('falls back to the same DLC when nobody covered the item yet, curated guides first', () => {
    const out = relatedChineseVideos(story('How to Get the Ratel', 'New in Echoes of Central Park'), pool).map((v) => v.id);
    expect(out.slice(0, 2)).toEqual(['mask'.padEnd(11, 'x'), 'park'.padEnd(11, 'x')]);
  });

  it('nothing for unrelated stories, and never the story’s own video', () => {
    expect(relatedChineseVideos(story('Costume contest winners'), pool)).toEqual([]);
    const own = { ...story('Master mission manhunt guide'), videoId: 'hunt'.padEnd(11, 'x') };
    expect(relatedChineseVideos(own, pool).map((v) => v.id)).not.toContain('hunt'.padEnd(11, 'x'));
  });
});
