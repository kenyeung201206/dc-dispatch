import { describe, expect, it } from 'vitest';
import { backPage, seeded, tickerJokes } from '../../src/lib/humour.ts';
import { EditionSchema, type Patch } from '../../src/schema/item.ts';
import proto from '../fixtures/edition-prototype.json' with { type: 'json' };

const edition = EditionSchema.parse(proto);
const patch: Patch = {
  version: 'Y8S3.3',
  title: 't',
  url: 'https://www.ubisoft.com/x',
  publishedAt: '2026-11-02T15:45:00.000Z',
  sections: [],
  fixes: 1,
  knownIssues: 1,
  changes: [
    { text: 'a', direction: 'up' },
    { text: 'b', direction: 'up' },
  ],
};

describe('humour', () => {
  it('is deterministic by date and differs between days', () => {
    expect(backPage('en', edition, patch)).toEqual(backPage('en', edition, patch));
    const other = backPage('en', { ...edition, date: '2026-11-05' }, patch);
    expect(JSON.stringify(other)).not.toBe(JSON.stringify(backPage('en', edition, patch)));
    expect(seeded('x')()).toBe(seeded('x')());
  });

  it('uses topical jokes only when the day has a matching story', () => {
    const withCrossplay = { ...edition, items: edition.items.map((i) => ({ ...i, tags: ['crossplay'] })) };
    const none = { ...edition, items: edition.items.map((i) => ({ ...i, tags: [] })) };
    const hit = (e: typeof edition) => backPage('en', e, patch).classifieds.some((c) => c.includes('leaderboard'));
    expect(hit(withCrossplay)).toBe(true);
    expect(hit(none)).toBe(false);
  });

  it('Nerf-O-Meter reads the real patch numbers', () => {
    const bp = backPage('zh-hant', edition, patch);
    expect(bp.nerf).toMatchObject({ up: 2, down: 0, needle: 1, version: 'Y8S3.3' });
    expect(backPage('en', edition).nerf.needle).toBeNull();
  });

  it('writes both languages natively and scrambles a real term', () => {
    const zh = backPage('zh-hant', edition, patch);
    expect(zh.horoscope[0]!.sign).toMatch(/座$/);
    expect(zh.classifieds.every((c) => /[㐀-鿿]/.test(c))).toBe(true);
    expect(zh.scramble.puzzle).not.toBe(zh.scramble.answer);
    expect([...zh.scramble.puzzle].sort().join('')).toBe([...zh.scramble.answer.replace(/\s/g, '')].sort().join(''));
  });

  it('respects HUMOUR_LEVEL', () => {
    expect(tickerJokes('en', '2026-11-04', 'light')).toEqual([]);
    expect(tickerJokes('en', '2026-11-04', 'medium')).toHaveLength(1);
    expect(tickerJokes('en', '2026-11-04', 'full')).toHaveLength(2);
    expect(backPage('en', edition, patch, 'light').classifieds).toHaveLength(2);
  });
});
