// Exit 1 (GitHub then emails the owner) when the robot hasn't published for N hours (default 6, about 3 runs:
// it runs every 2 h and GitHub sometimes starts it an hour late). Reported in the first 3 hours of the problem,
// then once a day while it lasts, so a broken night is one email, not one every 2 hours.
// Usage: node scripts/check-stale.ts [hours]
import { readFileSync } from 'node:fs';

const maxHours = Number(process.argv[2] ?? 6);
const status = JSON.parse(readFileSync('data/status.json', 'utf8')) as { lastRun: string; edition: { date: string } };
const hours = (Date.now() - Date.parse(status.lastRun)) / 3_600_000;

if (!Number.isFinite(hours) || (hours > maxHours && (hours - maxHours) % 24 < 3)) {
  console.error(`STALE: last refresh ${status.lastRun} (${hours.toFixed(1)} h ago, limit ${maxHours} h). Check the "Daily edition" workflow: a failed "Check" step means a test broke.`);
  process.exit(1);
}
console.log(hours > maxHours ? `Still stale (${hours.toFixed(1)} h), already reported today.` : `OK: edition ${status.edition.date}, last refresh ${hours.toFixed(1)} h ago.`);
