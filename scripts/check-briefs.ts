// Exit 1 if a story in the newest edition has had no 重點整理 for more than N hours (default 12),
// i.e. the scheduled writer (docs/BRIEF_WRITER.md) keeps skipping it or stopped running.
// Usage: node scripts/check-briefs.ts [hours]
import { readdirSync, readFileSync } from 'node:fs';

const maxHours = Number(process.argv[2] ?? 12);
const briefs = JSON.parse(readFileSync('data/briefs.zh.json', 'utf8')).items as Record<string, unknown>;
const file = readdirSync('data/editions')
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort()
  .reverse()
  .find((f) => !JSON.parse(readFileSync(`data/editions/${f}`, 'utf8')).fixture);
if (!file) {
  console.log('OK: no editions yet.');
  process.exit(0);
}
const items = JSON.parse(readFileSync(`data/editions/${file}`, 'utf8')).items as {
  id: string;
  sourceId: string;
  sourceUrl: string;
  title_orig: string;
  firstSeenAt?: string;
  publishedAt: string;
}[];
const now = Date.now();
let skipped: Record<string, unknown> = {};
try {
  skipped = JSON.parse(readFileSync('data/skipped-stories.json', 'utf8')).items ?? {};
} catch {}
const late = items.filter((i) => !briefs[i.id] && !(i.id in skipped) && (now - Date.parse(i.firstSeenAt ?? i.publishedAt)) / 3_600_000 > maxHours);

if (late.length) {
  console.error(`MISSING 重點整理: ${late.length} story/stories in ${file} still have none after ${maxHours} h.`);
  for (const i of late) console.error(`- ${i.id} (${i.sourceId}) ${i.title_orig.slice(0, 80)} — ${i.sourceUrl}`);
  console.error('Check the latest run of the "dc-dispatch 重點整理 writer" routine at https://claude.ai/code/routines');
  process.exit(1);
}
const waiting = items.filter((i) => !briefs[i.id]).length;
console.log(`OK: every story older than ${maxHours} h in ${file} has its 重點整理${waiting ? ` (${waiting} newer one(s) still within the window)` : ''}.`);
