// Exit 1 if the newest edition's last run is older than N hours (default 36).
// Usage: node scripts/check-stale.ts [hours]
import { readFileSync } from 'node:fs';

const maxHours = Number(process.argv[2] ?? 36);
const status = JSON.parse(readFileSync('data/status.json', 'utf8')) as { lastRun: string; edition: { date: string } };
const hours = (Date.now() - Date.parse(status.lastRun)) / 3_600_000;

if (!Number.isFinite(hours) || hours > maxHours) {
  console.error(`STALE: last refresh ${status.lastRun} (${hours.toFixed(1)} h ago, limit ${maxHours} h). Check the "Daily edition" workflow.`);
  process.exit(1);
}
console.log(`OK: edition ${status.edition.date}, last refresh ${hours.toFixed(1)} h ago.`);
