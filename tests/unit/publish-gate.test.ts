import { describe, expect, it } from 'vitest';
import { alreadyReported, failedChecks } from '../../scripts/publish-gate.ts';

describe('publish gate: names the failed checks in the email and on the status page', () => {
  it('reads failing test names from the real 2026-11-10 robot log', () => {
    const log = [
      '\x1b[31m❯\x1b[39m tests/unit/guides.test.ts (8 tests | 1 failed)',
      '\x1b[41m\x1b[1m FAIL \x1b[22m\x1b[49m tests/unit/guides.test.ts\x1b[2m > \x1b[22m灰帽特工 curated posts\x1b[2m > \x1b[22monly recent, unexpired posts become stories, in their own section, never official',
      'AssertionError: expected [ ... ] to deeply equal [ ... ]',
    ].join('\n');
    expect(failedChecks(log)).toEqual(['guides.test.ts > 灰帽特工 curated posts > only recent, unexpired posts become stories, in their own section, never official']);
  });
  it('falls back to a readable label', () => {
    expect(failedChecks('i18n check failed:\n  en: missing "x"')).toEqual(['i18n check (Chinese/English labels)']);
    expect(failedChecks('something odd')).toEqual(['unknown check (see the run log)']);
  });
});

describe('publish gate: one email a day per problem', () => {
  const now = new Date('2026-11-14T02:00:00Z');
  const prev = { at: '2026-11-13T20:00:00Z', failed: ['zh.test.ts > exotics have Chinese'] };
  it('stays quiet when the same checks failed and were reported less than 24 h ago', () => {
    expect(alreadyReported(['zh.test.ts > exotics have Chinese'], prev, now)).toBe('2026-11-13T20:00:00Z');
  });
  it('reports again for a different problem, or after 24 h', () => {
    expect(alreadyReported(['guides.test.ts > something else'], prev, now)).toBeUndefined();
    expect(alreadyReported(prev.failed, { ...prev, at: '2026-11-13T01:00:00Z' }, now)).toBeUndefined();
    expect(alreadyReported(prev.failed, undefined, now)).toBeUndefined();
  });
});
