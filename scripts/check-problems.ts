// Watchdog: emails the owner (by failing) when the self-repair routine couldn't fix something:
// a problem marked needs-owner, or one still open 6 h after it was recorded (the routine runs hourly).
// Once when it starts, then once a day while it lasts. Run: node scripts/check-problems.ts
import { existsSync, readFileSync } from 'node:fs';
import type { Problems } from './record-problem.ts';

export function toReport(file: Problems, now: Date) {
  return file.problems.filter((p) => {
    if (p.status === 'fixed') return false;
    const h = (now.getTime() - Date.parse(p.at)) / 3_600_000;
    const from = p.status === 'needs-owner' ? 0 : 6;
    return h >= from && (h - from) % 24 < 2;
  });
}

if (process.argv[1]?.endsWith('check-problems.ts')) {
  const file: Problems = existsSync('data/problems.json') ? JSON.parse(readFileSync('data/problems.json', 'utf8')) : { _note: '', problems: [] };
  const bad = toReport(file, new Date());
  for (const p of bad) console.error(`::error::${p.status === 'needs-owner' ? 'Needs you' : 'Not fixed after 6 h'}: ${p.workflow} — ${p.signature}${p.note ? ` — ${p.note}` : ''} (${p.url})`);
  if (bad.length) process.exit(1);
  const open = file.problems.filter((p) => p.status !== 'fixed').length;
  console.log(open ? `${open} problem(s) being handled by self-repair.` : 'No open problems.');
}
