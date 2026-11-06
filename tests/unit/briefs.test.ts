import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BriefsZhSchema } from '../../src/schema/item.ts';

const briefs = BriefsZhSchema.parse(JSON.parse(readFileSync('data/briefs.zh.json', 'utf8')));
// A write-up whose story has dropped out of the editions is harmless (no page uses it, and it is reused if the
// story comes back), so it must never stop the robot from publishing. Only the data itself is checked here.

describe('重點整理 (data/briefs.zh.json)', () => {
  it('has story-id keys and keeps every table row complete', () => {
    for (const [id, b] of Object.entries(briefs.items)) {
      expect(id, id).toMatch(/^[a-z0-9]{3,16}$/);
      for (const t of b.tables ?? []) for (const r of t.rows) expect(r, `${id} / ${t.title}`).toHaveLength(t.columns.length);
    }
  });

  it('is Chinese only (no English sentences on Chinese pages)', () => {
    for (const b of Object.values(briefs.items)) {
      for (const s of [...b.points, ...(b.body ?? [])]) expect(s, s).toMatch(/[㐀-鿿]/);
    }
  });
});
