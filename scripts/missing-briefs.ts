/**
 * Lists the newest edition's stories that have no 重點整理 yet (used by the scheduled writer,
 * docs/BRIEF_WRITER.md). Prints JSON: [{ id, sourceId, sourceUrl, title, headline_zhHant, needsZhTitle }].
 *   node scripts/missing-briefs.ts
 */
import { readdirSync, readFileSync } from 'node:fs';

const briefs = JSON.parse(readFileSync('data/briefs.zh.json', 'utf8')).items as Record<string, unknown>;
const tr = JSON.parse(readFileSync('data/translations.zh.json', 'utf8')).items as Record<string, unknown>;
const files = readdirSync('data/editions')
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort()
  .reverse();

for (const f of files) {
  const e = JSON.parse(readFileSync(`data/editions/${f}`, 'utf8'));
  if (e.fixture) continue;
  const pending = (v?: string) => !v || v === 'pending';
  const missing = (e.items as { id: string; sourceId: string; sourceUrl: string; title_orig: string; headline_zhHant?: string; summary_zhHant?: string }[])
    .filter((i) => !briefs[i.id])
    .map((i) => ({
      id: i.id,
      sourceId: i.sourceId,
      sourceUrl: i.sourceUrl,
      title: i.title_orig,
      headline_zhHant: i.headline_zhHant,
      needsZhTitle: (pending(i.headline_zhHant) || pending(i.summary_zhHant)) && !tr[i.id],
    }));
  console.log(JSON.stringify({ edition: f.slice(0, 10), missing }, null, 2));
  break;
}
