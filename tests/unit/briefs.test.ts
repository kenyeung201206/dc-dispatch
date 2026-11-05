import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BriefsZhSchema } from '../../src/schema/item.ts';

const briefs = BriefsZhSchema.parse(JSON.parse(readFileSync('data/briefs.zh.json', 'utf8')));
const ids = new Set(
  readdirSync('data/editions')
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .flatMap((f) => (JSON.parse(readFileSync(`data/editions/${f}`, 'utf8')).items as { id: string }[]).map((i) => i.id)),
);

describe('重點整理 (data/briefs.zh.json)', () => {
  it('belongs to real stories and keeps every table row complete', () => {
    for (const [id, b] of Object.entries(briefs.items)) {
      expect(ids.has(id), id).toBe(true);
      for (const t of b.tables ?? []) for (const r of t.rows) expect(r, `${id} / ${t.title}`).toHaveLength(t.columns.length);
    }
  });

  it('is Chinese only (no English sentences on Chinese pages)', () => {
    for (const b of Object.values(briefs.items)) {
      for (const s of [...b.points, ...(b.body ?? [])]) expect(s, s).toMatch(/[㐀-鿿]/);
    }
  });
});
