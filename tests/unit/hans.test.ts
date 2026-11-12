import { describe, expect, it } from 'vitest';
import { simplifyHtml } from '../../scripts/simplify.ts';
import { asciiJson, hansTable } from '../../src/lib/hans.ts';
import { LOCALES, switchLocalePath, t } from '../../src/i18n/index.ts';

describe('简体中文 pages', () => {
  it('has three languages, Traditional Chinese first (the default)', () => {
    expect(LOCALES).toEqual(['zh-hant', 'zh-hans', 'en']);
    expect(switchLocalePath('/zh-hant/story/abc/', 'zh-hans')).toBe('/zh-hans/story/abc/');
    expect(t('zh-hans', 'site.name')).toBe(t('zh-hant', 'site.name')); // converted after the build
  });

  it('converts the text and its language tags, but keeps links to the Traditional pages', () => {
    const page = [
      '<html lang="zh-Hant-TW"><head><title>華盛頓每日快報</title>',
      '<link rel="alternate" hreflang="zh-Hant-TW" href="https://dc-dispatch.pages.dev/zh-hant/">',
      '</head><body><h2 class="tt" lang="zh-Hant-TW">中央公園的迴響：奇特武器與裝備</h2>',
      '<span data-lang="zh-Hant-TW"></span>',
      '<a href="/zh-hant/" hreflang="zh-Hant-TW" lang="zh-Hant-TW" data-lang-switch="zh-hant">繁體中文</a>',
      '<a href="/zh-hans/" hreflang="zh-Hans" lang="zh-Hans" data-lang-switch="zh-hans">简体中文</a>',
      '</body></html>',
    ].join('');
    const out = simplifyHtml(page);
    expect(out).toContain('<html lang="zh-Hans">');
    expect(out).toContain('<title>华盛顿每日快报</title>');
    expect(out).toContain('lang="zh-Hans">中央公园的回响：奇特武器与装备</h2>');
    expect(out).toContain('data-lang="zh-Hans"');
    expect(out).toContain('hreflang="zh-Hant-TW" href="https://dc-dispatch.pages.dev/zh-hant/"');
    expect(out).toContain('data-lang-switch="zh-hant">繁體中文</a>');
    expect(out).not.toMatch(/\u0000/);
  });

  it('only changes character forms, not wording (names stay as we wrote them)', () => {
    expect(simplifyHtml('<p>軟體資訊</p>')).toBe('<p>软体资讯</p>');
  });

  it('gives the live loot box a small character table that survives the page conversion', () => {
    const table = hansTable();
    expect(table['華']).toBe('华');
    expect(table['戰']).toBe('战');
    expect(table['中']).toBeUndefined();
    const json = asciiJson(table);
    expect(json.length).toBeLessThan(60_000);
    expect(simplifyHtml(json)).toBe(json);
    expect(JSON.parse(simplifyHtml(json))['華']).toBe('华');
  });
});
