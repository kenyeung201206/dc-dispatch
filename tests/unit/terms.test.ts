import { describe, expect, it } from 'vitest';
import { zhTerms } from '../../src/lib/terms.ts';
import termNames from '../../data/term-names.json' with { type: 'json' };

describe("players' words (zhTerms)", () => {
  it('高潮任務 → 追捕/狩獵任務（Manhunt） first, then 追捕任務', () => {
    expect(zhTerms('完成偵查後，高潮任務可能鎖住；重新登入後高潮任務會出現。')).toBe('完成偵查後，追捕/狩獵任務（Manhunt）可能鎖住；重新登入後追捕任務會出現。');
  });
  it('does not double an English name already in brackets', () => {
    expect(zhTerms('適合高潮任務（Climax Mission）')).toBe('適合追捕/狩獵任務（Manhunt）');
  });
  it('異色 / 異彩 (and Simplified) exotics become 奇特', () => {
    expect(zhTerms('中央公園全新異色零件刷點')).toBe('中央公園全新奇特零件刷點');
    expect(zhTerms('快速累積異彩零件，拿新异色武器與異色手套')).toBe('快速累積奇特零件，拿新奇特武器與奇特手套');
  });
  it('leaves ordinary 異色 (a colour) alone', () => {
    expect(zhTerms('這面具有異色光澤')).toBe('這面具有異色光澤');
  });
  it('leaves 奇特 / 奇特零件 and other text alone', () => {
    expect(zhTerms('10 個奇特零件與奇特手套')).toBe('10 個奇特零件與奇特手套');
  });
});

describe('English game terms get their Chinese name (owner request 2026-11-14)', () => {
  it('adds （中文） after the first English mention only', () => {
    expect(zhTerms('新增奇特面具 Forward Observer、裝備組 Field General')).toBe('新增奇特面具 Forward Observer（前進觀測員）、裝備組 Field General（戰地將軍）');
    expect(zhTerms('Escalation 全面改版；Escalation 指令')).toBe('Escalation（戰鬥升級） 全面改版；Escalation 指令');
  });
  it('never doubles a name that is already there, in either order', () => {
    expect(zhTerms('前進觀測員（Forward Observer）已加入')).toBe('前進觀測員（Forward Observer）已加入');
    expect(zhTerms('PTS（公開測試）已開')).toBe('PTS（公開測試）已開');
    expect(zhTerms('中央公園的迴響（Echoes of Central Park）')).toBe('中央公園的迴響（Echoes of Central Park）');
  });
  it('matches whole terms only, longest first, and leaves unknown names alone', () => {
    expect(zhTerms('Perfect Technophobia 與 Technophobia')).toBe('Perfect Technophobia（完美科技恐懼症） 與 Technophobia');
    expect(zhTerms('nemesisX 不是 Nemesis')).toBe('nemesisX 不是 Nemesis（復仇女神）');
    expect(zhTerms('Spearfall 搶先看')).toBe('Spearfall 搶先看');
  });
  it('every name has a source, and no English term is listed twice', () => {
    const t = (termNames as { terms: { en: string; zh: string; source: string }[] }).terms;
    for (const x of t) {
      expect(x.zh, x.en).toMatch(/[㐀-鿿]/);
      expect(x.source.length, x.en).toBeGreaterThan(3);
    }
    expect(new Set(t.map((x) => x.en.toLowerCase())).size).toBe(t.length);
  });
});
