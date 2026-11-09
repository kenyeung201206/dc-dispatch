// Fails (so GitHub emails the owner) when a news source (Steam, Ubisoft EN/繁中, 巴哈, 巴哈 熱門討論) has failed or returned
// nothing for 6+ hours; then once a day while it lasts. Run: node scripts/check-sources.ts
import { readFileSync } from 'node:fs';
import { sourcesToReport, type SourceHealth } from '../pipeline/health.ts';

const status = JSON.parse(readFileSync('data/status.json', 'utf8')) as { sources: SourceHealth[] };
const bad = sourcesToReport(status.sources, new Date());
if (bad.length) {
  for (const s of bad) console.error(`Source "${s.id}" not working since ${s.failingSince} (${s.ok ? 'returned nothing' : 'fetch or parse failed'}${s.note ? `: ${s.note}` : ''}).`);
  console.error('Check the "Daily edition" run log for that source.');
  process.exit(1);
}
const failing = status.sources.filter((s) => s.failingSince).map((s) => s.id);
console.log(failing.length ? `Sources recovering or just started failing (not yet 6 h): ${failing.join(', ')}` : `All ${status.sources.length} sources OK.`);
