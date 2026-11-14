import { describe, expect, it } from 'vitest';
import { toReport } from '../../scripts/check-problems.ts';
import { record, signatureOf, tidyLog, type Problems } from '../../scripts/record-problem.ts';

// The real failed "Publish write-ups" log from 2026-11-14 (shortened).
const LOG = [
  'publish\tCheck\t2026-11-14T00:52:07.9731796Z ^[[31m     ^[[31m×^[[31m exotics and patches have Chinese^[[39m',
  'publish\tCheck\t2026-11-14T00:52:10.1215473Z ^[[31m^[[1mAssertionError^[[22m: expected \'\' to match /[㐀-鿿]/^[[39m',
  'publish\tCheck\t2026-11-14T00:52:10.1610100Z ##[error]Process completed with exit code 1.',
].join('\n');
const empty = (): Problems => ({ _note: '', problems: [] });

describe('self-repair: recording failed runs', () => {
  it('keeps the error lines readable and names the failure', () => {
    const log = tidyLog(LOG);
    expect(log).not.toMatch(/\^\[|2026-11-14T00/);
    expect(signatureOf(log)).toContain('exotics and patches have Chinese');
  });
  it('counts the same failure on the open problem instead of adding another', () => {
    const f = empty();
    const run = { workflow: 'Publish write-ups', url: 'https://x/1', failedSteps: 'Check', log: LOG };
    record(f, run, new Date('2026-11-14T01:00:00Z'));
    record(f, { ...run, url: 'https://x/2' }, new Date('2026-11-14T03:00:00Z'));
    expect(f.problems).toHaveLength(1);
    expect(f.problems[0]).toMatchObject({ seen: 2, status: 'open', url: 'https://x/2', attempts: 0 });
    f.problems[0]!.status = 'fixed';
    record(f, run, new Date('2026-11-14T05:00:00Z'));
    expect(f.problems.map((p) => p.status)).toEqual(['fixed', 'open']); // back again after a fix: a new problem
  });
});

describe('self-repair: when the owner is emailed', () => {
  const at = '2026-11-14T00:00:00Z';
  const h = (n: number) => new Date(Date.parse(at) + n * 3_600_000);
  const one = (status: 'open' | 'needs-owner' | 'fixed') => ({ _note: '', problems: [{ ...record(empty(), { workflow: 'CI', url: '', failedSteps: '', log: LOG }, new Date(at)).problems[0]!, status }] });
  it('needs-owner: right away, then once a day', () => {
    expect(toReport(one('needs-owner'), h(1))).toHaveLength(1);
    expect(toReport(one('needs-owner'), h(5))).toHaveLength(0);
    expect(toReport(one('needs-owner'), h(25))).toHaveLength(1);
  });
  it('open: only if self-repair hasn\'t fixed it within 6 hours; fixed: never', () => {
    expect(toReport(one('open'), h(3))).toHaveLength(0);
    expect(toReport(one('open'), h(7))).toHaveLength(1);
    expect(toReport(one('fixed'), h(7))).toHaveLength(0);
  });
});
