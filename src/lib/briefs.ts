import raw from '../../data/briefs.zh.json' with { type: 'json' };
import { BriefsZhSchema } from '../schema/item.ts';

const parsed = BriefsZhSchema.safeParse(raw);
if (!parsed.success) throw new Error(`Invalid data/briefs.zh.json: ${parsed.error.message}`);
for (const [id, b] of Object.entries(parsed.data.items))
  for (const t of b.tables ?? []) for (const r of t.rows) if (r.length !== t.columns.length) throw new Error(`briefs.zh.json ${id}: a row in "${t.title}" has ${r.length} cells, needs ${t.columns.length}`);

/** The Chinese 重點整理 for a story, if one was written. */
export const briefFor = (id: string) => parsed.data.items[id];
