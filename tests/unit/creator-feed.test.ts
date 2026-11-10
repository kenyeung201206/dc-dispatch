// Frozen copies of the robot's data files (tests/fixtures/data): the robot changes the real ones every run,
// and a test that counts live posts would block publishing (it did on 2026-11-10).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { agoToDate, mergeFeed, parsePostsPage } from '../../pipeline/creator-feed.ts';
import { creatorPostStories } from '../../pipeline/creator-posts.ts';
import { CreatorPostsSchema, ItemSchema } from '../../src/schema/item.ts';

const post = (postId: string, ago: string, runs: unknown[]) => ({ backstagePostRenderer: { postId, contentText: { runs }, publishedTimeText: { runs: [{ text: ago }] } } });
const page = (...posts: unknown[]) =>
  `<html><script>var ytInitialData = ${JSON.stringify({ contents: { tabs: [{ items: posts }] } })};</script></html>`;

const now = new Date('2026-11-20T03:00:00Z');
const data = () => CreatorPostsSchema.parse(JSON.parse(readFileSync('tests/fixtures/data/creator-posts.json', 'utf8')));

describe('灰帽特工 posts tab → site data', () => {
  it('reads posts, unwrapping YouTube redirect links', () => {
    const html = page(
      post('UgkxAAAA', '3 小時前', [
        { text: '維護警報!\n更新日志:\n' },
        { text: 'https://www.ubisoft.com/…', navigationEndpoint: { urlEndpoint: { url: 'https://www.youtube.com/redirect?q=https%3A%2F%2Fwww.ubisoft.com%2Fnews%2Fx' } } },
      ]),
    );
    expect(parsePostsPage(html)).toEqual([{ postId: 'UgkxAAAA', ago: '3 小時前', text: '維護警報!\n更新日志:\nhttps://www.ubisoft.com/news/x', link: 'https://www.ubisoft.com/news/x' }]);
    expect(parsePostsPage('<html>no data</html>')).toEqual([]);
  });

  it('turns "x ago" (Chinese or English) into a day', () => {
    expect(agoToDate('21 小時前', now)).toBe('2026-11-19');
    expect(agoToDate('2 days ago', now)).toBe('2026-11-18');
    expect(agoToDate('2 週前', now)).toBe('2026-11-06');
  });

  it('adds a new manhunt mission to its season, and it runs as a story', () => {
    const d = data();
    const feed = parsePostsPage(page(post('UgkxMISSION1', '2 小時前', [{ text: 'Y8S4獵捕偵查任務1:\n\n1.擊殺20名鬣狗\n\n2.完成一次據點\n\n3.完成指定懸賞' }])));
    expect(mergeFeed(d, feed, now)).toEqual({ missions: ['Y8S4 獵捕偵查任務 1'], posts: [] });
    const s = d.series.find((x) => x.id === 'y8s4-manhunt-scouts')!;
    expect(s.entries[0]).toMatchObject({ n: 1, steps_zhHant: ['擊殺20名鬣狗', '完成一次據點', '完成指定懸賞'], publishedAt: '2026-11-20' });
    const story = creatorPostStories(d, now).find((i) => i.headline_zhHant === 'Y8S4 獵捕偵查任務 1')!;
    expect(story.category).toBe('missions');
    expect(ItemSchema.safeParse(story).success).toBe(true);
  });

  it('adds other posts with their codes, and never adds the same post twice', () => {
    const d = data();
    const feed = parsePostsPage(page(post('UgkxCODES01', '1 天前', [{ text: '特工們:\n\n新的兌換碼來了!\n\nCDK:\nABC-DEF-123-XYZ\n\n兌換鏈接:\nhttps://redeem.ubisoft.com/thedivision2' }])));
    expect(mergeFeed(d, feed, now).posts).toEqual(['新的兌換碼來了']);
    expect(d.posts[0]).toMatchObject({ title_zhHant: '新的兌換碼來了', codes: [{ code: 'ABC-DEF-123-XYZ' }], category: 'community', auto: true });
    expect(d.posts[0]!.text_zhHant).toBe('新的兌換碼來了'); // code + link lines live in chips/buttons
    expect(mergeFeed(d, feed, now)).toEqual({ missions: [], posts: [] });
    expect(CreatorPostsSchema.safeParse(d).success).toBe(true);
  });

  it('skips posts already on the site (all of today\'s posts tab)', () => {
    const d = data();
    const feed = (d.knownPostIds ?? []).map((postId) => ({ postId, ago: '1 天前', text: '舊貼文' }));
    expect(feed.length).toBeGreaterThan(5);
    expect(mergeFeed(d, feed, now)).toEqual({ missions: [], posts: [] });
  });
});
