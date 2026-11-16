/**
 * Lists the newest edition's stories that have no 重點整理 yet (used by the scheduled writer,
 * docs/BRIEF_WRITER.md). Prints JSON: [{ id, sourceId, sourceUrl, title, partOfArticle?, partTitle?, partText?, headline_zhHant, needsZhTitle, sourceText? }].
 * sourceText = the video description the robot saved (data/source-notes.json), when there is one.
 *   node scripts/missing-briefs.ts
 */
import { readdirSync, readFileSync } from 'node:fs';

const briefs = JSON.parse(readFileSync('data/briefs.zh.json', 'utf8')).items as Record<string, unknown>;
const tr = JSON.parse(readFileSync('data/translations.zh.json', 'utf8')).items as Record<string, unknown>;
let skipped: Record<string, unknown> = {};
try {
  skipped = JSON.parse(readFileSync('data/skipped-stories.json', 'utf8')).items ?? {};
} catch {}
// Video descriptions saved by the robot (YouTube API); the cloud can't load youtube.com itself.
let notes: Record<string, { text: string }> = {};
try {
  notes = JSON.parse(readFileSync('data/source-notes.json', 'utf8'));
} catch {}
const files = readdirSync('data/editions')
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort()
  .reverse();

for (const f of files) {
  const e = JSON.parse(readFileSync(`data/editions/${f}`, 'utf8'));
  if (e.fixture) continue;
  const pending = (v?: string) => !v || v === 'pending';
  type Story = { id: string; sourceId: string; sourceUrl: string; title_orig: string; headline_en?: string; summary_en?: string; headline_zhHant?: string; summary_zhHant?: string };
  const all = e.items as Story[];
  // One article can make several stories (each known issue in patch notes is its own story). Those share the
  // article's title and link, so the writer gets each one's own text, and must write only about that part
  // (2026-11-16: four known issues all got the whole article's summary and looked like duplicates).
  const sameLink = (i: Story) => all.filter((x) => x.sourceUrl === i.sourceUrl).length > 1;
  const missing = all
    // Also stories that have a 重點整理 but still no Chinese title/summary (Chinese pages hide those).
    .filter((i) => !(i.id in skipped))
    .filter((i) => !briefs[i.id] || ((pending(i.headline_zhHant) || pending(i.summary_zhHant)) && !tr[i.id]))
    .map((i) => ({
      hasBrief: Boolean(briefs[i.id]),
      id: i.id,
      sourceId: i.sourceId,
      sourceUrl: i.sourceUrl,
      title: i.title_orig,
      ...(sameLink(i) ? { partOfArticle: true, partTitle: i.headline_en, partText: i.summary_en } : {}),
      headline_zhHant: i.headline_zhHant,
      needsZhTitle: (pending(i.headline_zhHant) || pending(i.summary_zhHant)) && !tr[i.id],
      ...(notes[i.id] ? { sourceText: notes[i.id]!.text } : {}),
    }));
  console.log(JSON.stringify({ edition: f.slice(0, 10), missing }, null, 2));
  break;
}
