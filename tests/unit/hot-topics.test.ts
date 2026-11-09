import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseBahamutHot } from '../../pipeline/sources/bahamut.ts';
import { trackHealth } from '../../pipeline/health.ts';
import { HotTopicsSchema } from '../../src/schema/item.ts';
import { hotTitle } from '../../src/lib/hot-topics.ts';

const board = readFileSync('tests/fixtures/sources/bahamut-board-full.html', 'utf8');
// The fixture was saved on 2026-11-04 around noon Taiwan time.
const now = new Date('2026-11-04T12:00:00+08:00');

describe('巴哈 熱門討論 parser', () => {
  const hot = parseBahamutHot(board, now);

  it('picks the 5 busiest player threads, most replies first', () => {
    expect(hot.map((h) => [h.id, h.replies])).toEqual([
      ['32858', 25],
      ['32859', 13],
      ['32868', 12],
      ['32867', 9],
      ['32863', 9],
    ]);
    // Ties on replies go to the thread with more views.
    expect(hot[3].views).toBeGreaterThan(hot[4].views);
    expect(hot[0]).toMatchObject({ tag: '問題', title: '【問題】現在稻草人懸賞還會掉核心人物嗎?', url: 'https://forum.gamer.com.tw/C.php?bsn=24460&snA=32858', views: 1746 });
  });

  it('keeps only 討論/閒聊/問題 threads and skips pinned ones', () => {
    expect(hot.every((h) => ['討論', '閒聊', '問題'].includes(h.tag))).toBe(true);
    const all = parseBahamutHot(board, now, { days: 365, limit: 99 });
    expect(all.some((h) => h.title.includes('新手幫助'))).toBe(false); // pinned 集中串, 1,260 replies
    expect(all.some((h) => h.title.startsWith('【情報】'))).toBe(false);
    expect(all.some((h) => h.title === '【閒聊】哪個官方87設計的邪教出生點...')).toBe(true);
  });

  it('drops threads with no reply in the window', () => {
    const all = parseBahamutHot(board, now, { days: 365, limit: 99 });
    const week = parseBahamutHot(board, now, { days: 7, limit: 99 });
    expect(all.length).toBeGreaterThan(week.length);
    const since = now.getTime() - 7 * 86_400_000;
    expect(week.every((h) => Date.parse(h.lastReplyAt) >= since)).toBe(true);
  });

  it('stores titles, links and counts only (no usernames or post text)', () => {
    for (const h of hot) expect(Object.keys(h).sort()).toEqual(['id', 'lastReplyAt', 'replies', 'tag', 'title', 'url', 'views']);
    expect(() => HotTopicsSchema.parse({ updatedAt: now.toISOString(), topics: hot })).not.toThrow();
  });

  it('fails loudly when the layout changes', () => {
    expect(() => parseBahamutHot('<html></html>', now)).toThrow(/layout changed/);
    // The trimmed news fixture has rows but no reply counts.
    expect(() => parseBahamutHot(readFileSync('tests/fixtures/sources/bahamut.html', 'utf8'), now)).toThrow(/reply counts/);
  });

  it('is watched like a news source', () => {
    const [bad] = trackHealth(now, [{ id: 'bahamut-hot', ok: false, items: 0, note: 'x' }]);
    expect(bad.failingSince).toBe(now.toISOString());
  });

  it('shows titles without the 【tag】 prefix', () => {
    expect(hotTitle('【問題】配裝詢問')).toBe('配裝詢問');
    expect(hotTitle('沒有標籤')).toBe('沒有標籤');
  });
});
