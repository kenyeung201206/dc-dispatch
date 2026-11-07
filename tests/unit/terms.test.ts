import { describe, expect, it } from 'vitest';
import { zhTerms } from '../../src/lib/terms.ts';

describe("players' words (zhTerms)", () => {
  it('高潮任務 → 追捕/狩獵任務（Manhunt） first, then 追捕任務', () => {
    expect(zhTerms('完成偵查後，高潮任務可能鎖住；重新登入後高潮任務會出現。')).toBe('完成偵查後，追捕/狩獵任務（Manhunt）可能鎖住；重新登入後追捕任務會出現。');
  });
  it('does not double an English name already in brackets', () => {
    expect(zhTerms('適合高潮任務（Climax Mission）')).toBe('適合追捕/狩獵任務（Manhunt）');
  });
  it('leaves 奇特 / 奇特零件 and other text alone', () => {
    expect(zhTerms('10 個奇特零件與奇特手套')).toBe('10 個奇特零件與奇特手套');
  });
});
