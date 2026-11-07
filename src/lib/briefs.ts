import raw from '../../data/briefs.zh.json' with { type: 'json' };
import { BriefsZhSchema } from '../schema/item.ts';
import { zhTerms } from './terms.ts';

const parsed = BriefsZhSchema.safeParse(raw);
if (!parsed.success) throw new Error(`Invalid data/briefs.zh.json: ${parsed.error.message}`);
const items = parsed.data.items;
for (const [id, b] of Object.entries(items))
  for (const t of b.tables ?? []) for (const r of t.rows) if (r.length !== t.columns.length) throw new Error(`briefs.zh.json ${id}: a row in "${t.title}" has ${r.length} cells, needs ${t.columns.length}`);

/** The Chinese 重點整理 for a story, if one was written (in the players' words, see terms.ts). */
export function briefFor(id: string) {
  const b = items[id];
  if (!b) return undefined;
  return {
    ...b,
    points: b.points.map(zhTerms),
    body: b.body?.map(zhTerms),
    tables: b.tables?.map((t) => ({ ...t, title: zhTerms(t.title), rows: t.rows.map((r) => r.map(zhTerms)) })),
  };
}
