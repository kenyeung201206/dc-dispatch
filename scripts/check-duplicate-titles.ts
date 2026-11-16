// Fails when two different stories in the newest edition have the same Chinese title — readers see that as the same
// topic posted several times (2026-11-16: four Spearfall PTS known issues all got the whole article's title).
// Runs in the robot's and "Publish write-ups"' checks: a failure publishes in safe mode, is recorded in
// data/problems.json and fixed by the self-repair routine. Run: node scripts/check-duplicate-titles.ts
import { readdirSync, readFileSync } from 'node:fs';

type Story = { id: string; headline_zhHant?: string };

/** Groups of story ids that share a Chinese title (each group has 2 or more ids). */
export function duplicateTitles(items: Story[], translations: Record<string, { headline?: string }>): { title: string; ids: string[] }[] {
  const byTitle = new Map<string, string[]>();
  for (const i of items) {
    const title = (translations[i.id]?.headline ?? i.headline_zhHant ?? '').trim();
    if (!title || title === 'pending') continue;
    byTitle.set(title, [...(byTitle.get(title) ?? []), i.id]);
  }
  return [...byTitle].filter(([, ids]) => ids.length > 1).map(([title, ids]) => ({ title, ids }));
}

if (process.argv[1]?.endsWith('check-duplicate-titles.ts')) {
  const file = readdirSync('data/editions')
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse()
    .find((f) => !JSON.parse(readFileSync(`data/editions/${f}`, 'utf8')).fixture);
  if (!file) process.exit(0);
  const items = JSON.parse(readFileSync(`data/editions/${file}`, 'utf8')).items as Story[];
  const tr = JSON.parse(readFileSync('data/translations.zh.json', 'utf8')).items as Record<string, { headline?: string }>;
  let skipped: Record<string, unknown> = {};
  try {
    skipped = JSON.parse(readFileSync('data/skipped-stories.json', 'utf8')).items ?? {};
  } catch {}
  const dupes = duplicateTitles(items.filter((i) => !(i.id in skipped)), tr);
  if (dupes.length) {
    for (const d of dupes) console.error(`FAIL duplicate Chinese title in ${file}: "${d.title}" on ${d.ids.join(', ')}`);
    console.error('Each story needs its own title (for a part of a longer article, title that part: see docs/BRIEF_WRITER.md).');
    process.exit(1);
  }
  console.log(`OK: no duplicate Chinese titles in ${file}.`);
}
