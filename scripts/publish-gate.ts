// Decides whether the robot publishes after its "Check" step (refresh.yml), and explains why in plain words.
// - Checks passed → publish.
// - A check failed, but this exact code already passed CI (all tests on fixed data) → the failure comes from
//   today's data, not the code (2026-11-10: a test counting live 灰帽特工 posts stopped the paper for 7 h).
//   Publish in safe mode: the data already passed its format checks when it was written, and the build must
//   still succeed. data/status.json records it, so the status page shows it, and the run fails at the end
//   so GitHub emails the owner.
// - A check failed and this code hasn't passed CI → don't publish (the site keeps the last good edition).
// Usage: node scripts/publish-gate.ts <check-outcome: success|failure> <check-log-file>
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const [outcome = 'failure', logFile = 'check.log'] = process.argv.slice(2);
const out = (k: string, v: string) => process.env.GITHUB_OUTPUT && appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`);

/** Failing test names from vitest's output, e.g. "guides.test.ts > 灰帽特工 curated posts > only recent …". */
export function failedChecks(log: string): string[] {
  // eslint-disable-next-line no-control-regex
  // Colour codes: real escape characters in the live run, or the visible text "^[" in a downloaded log.
  const plain = log.replace(/(?:\x1b|\^\[)\[[0-9;]*m/g, '');
  const tests = [...plain.matchAll(/\bFAIL\s+(tests\/\S+ > .+?)\s*$/gm)].map((m) => m[1]!.replace(/^tests\/unit\//, ''));
  if (tests.length) return [...new Set(tests)].slice(0, 5);
  if (/i18n check failed/.test(plain)) return ['i18n check (Chinese/English labels)'];
  return ['unknown check (see the run log)'];
}

/**
 * True when the code (everything except the robot's data files) is identical to a commit that passed CI.
 * The robot's own data commits never trigger CI, so the commit it starts from usually has no CI result itself.
 */
export function codePassedCi(sha: string): boolean {
  const r = spawnSync('gh', ['run', 'list', '--workflow', 'ci.yml', '--status', 'success', '--limit', '30', '--json', 'headSha', '--jq', '.[].headSha'], { encoding: 'utf8' });
  if (r.status !== 0) return false;
  return r.stdout
    .split('\n')
    .filter(Boolean)
    .some((good) => spawnSync('git', ['diff', '--quiet', good, sha, '--', '.', ':(exclude)data', ':(exclude)public/icons']).status === 0);
}

if (process.argv[1]?.endsWith('publish-gate.ts')) {
  if (outcome === 'success') {
    out('publish', 'true');
    out('degraded', 'false');
    console.log('Checks passed: publishing normally.');
  } else {
    const failed = failedChecks(existsSync(logFile) ? readFileSync(logFile, 'utf8') : '');
    const sha = process.env.GITHUB_SHA ?? '';
    if (sha && codePassedCi(sha)) {
      const status = JSON.parse(readFileSync('data/status.json', 'utf8'));
      status.degraded = { at: new Date().toISOString(), failed };
      writeFileSync('data/status.json', JSON.stringify(status, null, 2) + '\n');
      out('publish', 'true');
      out('degraded', 'true');
      out('reason', `Published in safe mode. A check failed, but this code passed CI, so the cause is today's data: ${failed.join('; ')}`);
      console.log(`Safe mode: ${failed.join('; ')}`);
    } else {
      out('publish', 'false');
      out('degraded', 'false');
      out('reason', `NOT published (the site keeps the last good edition). A check failed and this code has not passed CI: ${failed.join('; ')}`);
      console.log(`Not publishing: ${failed.join('; ')}`);
    }
  }
}
