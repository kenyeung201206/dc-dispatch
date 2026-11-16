import { describe, expect, it } from 'vitest';
import { duplicateTitles } from '../../scripts/check-duplicate-titles.ts';

describe('every story has its own Chinese title (2026-11-16: four known issues shared one)', () => {
  const article = 'Spearfall PTS 更新說明：傳奇難度擴充、Escalation 取消計時器、原型藍圖';
  it('finds stories that share a Chinese title, from translations or the story itself', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c', headline_zhHant: article }, { id: 'd', headline_zhHant: '已知問題：敵人強度低於預期' }];
    expect(duplicateTitles(items, { a: { headline: article }, b: { headline: article } })).toEqual([{ title: article, ids: ['a', 'b', 'c'] }]);
  });
  it('ignores stories still waiting for Chinese, and different titles', () => {
    const items = [{ id: 'a', headline_zhHant: 'pending' }, { id: 'b', headline_zhHant: 'pending' }, { id: 'c', headline_zhHant: '已知問題：A' }, { id: 'd', headline_zhHant: '已知問題：B' }];
    expect(duplicateTitles(items, {})).toEqual([]);
  });
});

describe('safe-mode report names the duplicate check', async () => {
  const { failedChecks } = await import('../../scripts/publish-gate.ts');
  it('quotes the duplicate title line', () => {
    expect(failedChecks('FAIL duplicate Chinese title in 2026-11-16.json: "X" on a, b\nEach story needs its own title')).toEqual(['duplicate Chinese title in 2026-11-16.json: "X" on a, b']);
  });
});
