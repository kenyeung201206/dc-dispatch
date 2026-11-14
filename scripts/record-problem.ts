// Records a failed GitHub Actions run in data/problems.json, so the self-repair routine (docs/SELF_REPAIR.md, a
// cloud Claude routine) can read what broke without access to GitHub's logs, fix it, and mark it fixed.
// The same failure seen again is counted on the open problem instead of adding a new one.
// Usage (in retry.yml): node scripts/record-problem.ts <workflow> <run-url> <failed-steps> <log-file>
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export interface Problem {
  id: string;
  workflow: string;
  url: string;
  at: string;
  lastSeen: string;
  seen: number;
  failedSteps: string;
  /** First error line: what makes two failures "the same problem". */
  signature: string;
  log: string;
  status: 'open' | 'fixed' | 'needs-owner';
  attempts: number;
  note?: string;
}
export interface Problems {
  _note: string;
  problems: Problem[];
}

const NOTE =
  'Failed GitHub Actions runs, written by .github/workflows/retry.yml. The self-repair routine (docs/SELF_REPAIR.md) fixes open ones and sets status to fixed or needs-owner with a note.';

/** Plain text of a run log: colour codes gone (real or the visible "^[" form), timestamps dropped, last 80 lines. */
export function tidyLog(raw: string): string {
  return raw
    .replace(/(?:\x1b|\^\[)\[[0-9;]*m/g, '')
    .split('\n')
    .map((l) => l.replace(/^[^\t]*\t[^\t]*\t\S+Z\s?/, '').trimEnd())
    .filter((l) => l && !/^##\[(group|endgroup)\]/.test(l))
    .slice(-80)
    .join('\n');
}

/** The line that best names the failure. */
export function signatureOf(log: string): string {
  const lines = log.split('\n');
  const pick = lines.find((l) => /##\[error\]|AssertionError|Error:|FAIL\s|✘|×/.test(l)) ?? lines.at(-1) ?? '';
  return pick.replace(/##\[error\]/, '').replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, '').trim().slice(0, 200);
}

export function record(file: Problems, p: { workflow: string; url: string; failedSteps: string; log: string }, now: Date): Problems {
  const log = tidyLog(p.log);
  const signature = signatureOf(log);
  const same = file.problems.find((x) => x.status !== 'fixed' && x.workflow === p.workflow && x.signature === signature);
  if (same) {
    same.seen++;
    same.lastSeen = now.toISOString();
    same.url = p.url;
    same.log = log;
  } else {
    file.problems.push({ id: `${now.toISOString().slice(0, 16).replace(/[-:T]/g, '')}-${file.problems.length + 1}`, workflow: p.workflow, url: p.url, at: now.toISOString(), lastSeen: now.toISOString(), seen: 1, failedSteps: p.failedSteps, signature, log, status: 'open', attempts: 0 });
  }
  // Keep the file small: fixed problems older than 14 days go.
  file.problems = file.problems.filter((x) => x.status !== 'fixed' || now.getTime() - Date.parse(x.lastSeen) < 14 * 86_400_000);
  return file;
}

if (process.argv[1]?.endsWith('record-problem.ts')) {
  const [workflow = '?', url = '', failedSteps = '', logFile = ''] = process.argv.slice(2);
  const path = 'data/problems.json';
  const file: Problems = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { _note: NOTE, problems: [] };
  record(file, { workflow, url, failedSteps, log: logFile && existsSync(logFile) ? readFileSync(logFile, 'utf8') : '' }, new Date());
  writeFileSync(path, JSON.stringify(file, null, 1) + '\n');
  console.log(`Recorded: ${workflow} — ${file.problems.at(-1)?.signature}`);
}
