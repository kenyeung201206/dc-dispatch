import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EditionSchema, ExoticLogSchema, PatchLogSchema, VideoLibrarySchema } from '../../src/schema/item.ts';
import { exoticZh, hasZh, patchZh, sourceZh, videoTitleZh, withZh, zh } from '../../src/lib/zh.ts';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const CJK = /[㐀-鿿]/;

describe('Chinese-only pages', () => {
  it('every translation is actually Chinese', () => {
    for (const tr of Object.values(zh.items)) {
      expect(tr.headline).toMatch(CJK);
      expect(tr.summary).toMatch(CJK);
    }
    for (const v of Object.values(zh.videos)) expect(v).toMatch(CJK);
    for (const e of Object.values(zh.exotics)) expect(e.name).toMatch(CJK);
  });

  it('fills pending Chinese fields but never overwrites real ones', () => {
    const latest = EditionSchema.parse(read('data/editions/2026-11-05.json'));
    const pend = latest.items.find((i) => zh.items[i.id] && i.headline_zhHant === 'pending');
    if (pend) {
      const filled = withZh(pend);
      expect(hasZh(filled)).toBe(true);
      expect(filled.headline_en).toBe(pend.headline_en);
    }
    const done = latest.items.find((i) => i.headline_zhHant !== 'pending')!;
    expect(withZh({ ...done, id: Object.keys(zh.items)[0]! }).headline_zhHant).toBe(done.headline_zhHant);
  });

  it('videos: regional title, then Chinese original title, then our translation, else none', () => {
    expect(videoTitleZh({ id: 'x', title: 'Hello', titleZh: '你好' })).toBe('你好');
    expect(videoTitleZh({ id: 'x', title: '速刷血月' })).toBe('速刷血月');
    expect(videoTitleZh({ id: 'nope', title: 'English only' })).toBeUndefined();
    const vids = VideoLibrarySchema.parse(read('data/videos.json')).videos;
    expect(vids.filter((v) => videoTitleZh(v)).length).toBeGreaterThan(0);
  });

  it('exotics and patches have Chinese, and change lines line up one-to-one', () => {
    for (const e of ExoticLogSchema.parse(read('data/exotics.json')).exotics) expect(exoticZh(e).name ?? '').toMatch(CJK);
    for (const p of PatchLogSchema.parse(read('data/patches.json')).patches) {
      const z = patchZh(p);
      if (z.title) expect(z.changes?.length ?? 0).toBe(p.changes.length);
    }
  });

  it('outlet names are Chinese where it is a description, people stay as they are', () => {
    expect(sourceZh('Ubisoft (via Steam News)')).toMatch(CJK);
    expect(sourceZh('ManaWar Gaming')).toBe('ManaWar Gaming');
  });
});
