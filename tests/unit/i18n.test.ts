import { describe, expect, it } from 'vitest';
import { formatDate, switchLocalePath, t } from '../../src/i18n/index.ts';

describe('switchLocalePath', () => {
  it('keeps the reader on the same page', () => {
    expect(switchLocalePath('/en/', 'zh-hant')).toBe('/zh-hant/');
    expect(switchLocalePath('/zh-hant/story/abc/', 'en')).toBe('/en/story/abc/');
  });
  it('adds a locale when the path has none', () => {
    expect(switchLocalePath('/archive/', 'en')).toBe('/en/archive/');
  });
});

describe('formatDate', () => {
  it('uses Asia/Tokyo, so 21:30 UTC is already the next day', () => {
    expect(formatDate('2026-11-03T21:30:00Z', 'en')).toContain('November 4, 2026');
    expect(formatDate('2026-11-03T21:30:00Z', 'zh-hant')).toContain('2026年11月4日');
  });
});

describe('t', () => {
  it('returns the localized string', () => {
    expect(t('zh-hant', 'section.glitch-watch')).toBe('漏洞觀察');
  });
});
