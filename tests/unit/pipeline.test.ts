import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classify } from '../../pipeline/classify.ts';
import { canonicalUrl, dedupe } from '../../pipeline/dedupe.ts';
import { applyOverrides, assembleEdition } from '../../pipeline/edition.ts';
import { assertAllowedUrl } from '../../pipeline/http.ts';
import { storyToItems } from '../../pipeline/normalize.ts';
import { score } from '../../pipeline/score.ts';
import { parseSteamNews } from '../../pipeline/sources/steam.ts';
import { extractPreloadedState, parseUbisoftNews } from '../../pipeline/sources/ubisoft.ts';
import { parseKnownIssues, summarize } from '../../pipeline/summarize.ts';
import { detectLang, extractWords, toPlainText, wordCount } from '../../pipeline/text.ts';
import { EditionSchema, ImageLibrarySchema, type Item } from '../../src/schema/item.ts';
import images from '../../data/images.json' with { type: 'json' };
import glossary from '../../data/glossary.json' with { type: 'json' };

const fx = (f: string) => readFileSync(`tests/fixtures/sources/${f}`, 'utf8');
const steam = parseSteamNews(fx('steam-news.json'));
const ubiEn = parseUbisoftNews(fx('ubisoft-en.html'), 'ubisoft-en');
const ubiZh = parseUbisoftNews(fx('ubisoft-zh-tw.html'), 'ubisoft-zh-tw');
const NOW = new Date('2026-11-04T06:00:00+09:00');

describe('text', () => {
  it('strips HTML/BBCode/Markdown but keeps bracketed titles', () => {
    expect(toPlainText('[b]Hello[/b] <script>x()</script><i>world</i>')).toBe('Hello world');
    expect(toPlainText('[TUY8S3.3] Crossplay Rollout')).toBe('[TUY8S3.3] Crossplay Rollout');
    expect(toPlainText('## Title\n- **bold** [link](https://x.y)')).toBe('Title bold link');
  });
  it('detects languages', () => {
    expect(detectLang('Crossplay Rollout & More')).toBe('en');
    expect(detectLang('《全境封鎖 2》血月高照活動 Twitch 掉寶')).toBe('zh');
    expect(detectLang('Хоррор в Центральном парке')).toBe('ru');
  });
  it('keeps extracts within the quote limit', () => {
    const long = Array.from({ length: 60 }, (_, i) => `w${i}`).join(' ');
    expect(wordCount(extractWords(long, 25))).toBeLessThanOrEqual(25);
  });
});

describe('sources', () => {
  it('Steam: keeps English, drops Russian press, uses canonical store URLs', () => {
    expect(steam.length).toBeGreaterThan(5);
    expect(steam.every((s) => s.lang === 'en')).toBe(true);
    expect(steam.every((s) => s.url.startsWith('https://store.steampowered.com/news/app/2221490/view/'))).toBe(true);
    expect(steam.some((s) => s.confidence === 'reported')).toBe(true); // Rock, Paper, Shotgun
  });
  it('Ubisoft: parses news articles and skips videos', () => {
    expect(ubiEn.length).toBe(7);
    expect(ubiEn.find((u) => u.externalId === '7L8TlD1Hv0XC1prOD8mdte')?.title).toContain('TUY8S3.3');
    expect(ubiZh.find((u) => u.externalId === '5EEgwKS6kDqyvUFo5PJYsB')?.title).toContain('中央公園的迴響');
  });
  it('Ubisoft: state extraction copes with braces inside strings, never evals', () => {
    const html = '<script>window.__PRELOADED_STATE__ = {"a":"} { \\" }","b":{"c":1}};alert(1)</script>';
    expect(extractPreloadedState(html)).toEqual({ a: '} { " }', b: { c: 1 } });
  });
  it('fetcher refuses hosts outside the allowlist and plain http', () => {
    expect(() => assertAllowedUrl('https://evil.example/')).toThrow(/allowlist/);
    expect(() => assertAllowedUrl('http://www.ubisoft.com/')).toThrow(/https/);
    expect(() => assertAllowedUrl('https://www.ubisoft.com/en-us/')).not.toThrow();
  });
});

describe('dedupe, classify, score', () => {
  it('merges the Steam copy of the TU notes into the Ubisoft article', () => {
    const stories = dedupe([...steam, ...ubiEn]);
    const tu = stories.find((s) => s.primary.externalId === '7L8TlD1Hv0XC1prOD8mdte')!;
    expect(tu.primary.sourceId).toBe('ubisoft-en');
    expect(tu.others.some((o) => o.sourceId === 'steam-news')).toBe(true);
  });
  it('Steam and Ubisoft notes for the same title update are one story even with different titles', () => {
    const base = steam[0]!;
    const a = { ...base, externalId: 'a', url: 'https://store.steampowered.com/news/app/1/view/1', title: '[TUY8S3.3] Echoes of Central Park Launch, Crossplay Rollout & More' };
    const b = { ...base, externalId: 'b', sourceId: 'ubisoft-en' as const, url: 'https://www.ubisoft.com/x', title: '[TUY8S3.3] Crossplay Rollout, Conflict Improvements & More' };
    const c = { ...base, externalId: 'c', url: 'https://store.steampowered.com/news/app/1/view/2', title: '[TUY8S3.2] Red Moon Unleashed & More' };
    const stories = dedupe([a, b, c]);
    expect(stories).toHaveLength(2);
    expect(stories.find((s) => s.primary.externalId === 'b')!.others.map((o) => o.externalId)).toEqual(['a']);
  });
  it('canonical URLs ignore query and hash', () => {
    expect(canonicalUrl('https://WWW.ubisoft.com/a/?utm_source=x&fbclid=1#y')).toBe('https://www.ubisoft.com/a');
    expect(canonicalUrl('https://forum.gamer.com.tw/C.php?snA=2&bsn=24460&tnum=3')).toBe('https://forum.gamer.com.tw/C.php?bsn=24460&snA=2');
  });
  it('classifies by title first', () => {
    expect(classify('[TUY8S3.3] Crossplay Rollout, Conflict Improvements & More', '')).toBe('updates');
    expect(classify('Red Moon Unleashed Event Twitch Drops', '')).toBe('community');
    expect(classify('The Division Resurgence launches', '')).toBe('franchise');
    expect(classify('Patch notes', 'Known issues: lots')).toBe('updates');
  });
  it('newer stories score higher', () => {
    const base = { confidence: 'official' as const, headline_en: 'x', summary_en: 'y' };
    const fresh = score({ ...base, publishedAt: '2026-11-03T00:00:00Z' }, 0, NOW);
    const old = score({ ...base, publishedAt: '2026-10-20T00:00:00Z' }, 0, NOW);
    expect(fresh).toBeGreaterThan(old);
  });
});

describe('summaries and known issues', () => {
  it('uses official zh-TW text only when it is actually Chinese', () => {
    const drops = ubiEn.find((u) => u.externalId === '5EEgwKS6kDqyvUFo5PJYsB')!;
    const s = summarize(drops, ubiZh.find((z) => z.externalId === drops.externalId));
    expect(s.headline_zhHant).toContain('Twitch 掉寶');
    expect(s.summary_zhHant).not.toBe('pending');
    const tu = ubiEn.find((u) => u.externalId === '7L8TlD1Hv0XC1prOD8mdte')!;
    const t = summarize(tu, ubiZh.find((z) => z.externalId === tu.externalId));
    expect(t.headline_zhHant).toBe('pending'); // zh page shows the English title
  });
  it('reads Known Issues with workarounds from patch notes', () => {
    const tu = ubiEn.find((u) => u.externalId === '7L8TlD1Hv0XC1prOD8mdte')!;
    const issues = parseKnownIssues(tu.rawBody);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.issue).toMatch(/Climax Mission/);
    expect(issues[0]!.workaround).toMatch(/Log out/);
  });
});

function buildItems(): Item[] {
  const lib = ImageLibrarySchema.parse(structuredClone(images));
  const zhById = new Map(ubiZh.map((z) => [z.externalId, z]));
  return dedupe([...steam, ...ubiEn]).flatMap((s) => storyToItems(s, { now: NOW, zhById, images: lib }));
}
const ok = (['steam-news', 'ubisoft-en', 'ubisoft-zh-tw'] as const).map((sourceId) => ({ sourceId, ok: true, items: [] }));

describe('edition assembly', () => {
  it('builds a valid edition from fixtures with a Glitch Watch item', () => {
    const e = assembleEdition({ date: '2026-11-04', now: NOW, fresh: buildItems(), results: ok, overrides: {} });
    expect(EditionSchema.safeParse(e).success).toBe(true);
    expect(e.items.some((i) => i.category === 'glitch-watch' && i.glitch?.state === 'active')).toBe(true);
    expect(e.items.every((i) => i.sourceUrl.startsWith('https://'))).toBe(true);
  });
  it('never publishes an empty edition', () => {
    expect(() => assembleEdition({ date: '2026-11-04', now: NOW, fresh: [], results: ok, overrides: {} })).toThrow(/empty/);
  });
  it("keeps yesterday's items for a source that failed today", () => {
    const yesterday = assembleEdition({ date: '2026-11-03', now: NOW, fresh: buildItems(), results: ok, overrides: {} });
    const steamOnly = buildItems().filter((i) => i.sourceId === 'steam-news');
    const results = ok.map((r) => (r.sourceId === 'ubisoft-en' ? { ...r, ok: false } : r));
    const today = assembleEdition({ date: '2026-11-04', now: NOW, fresh: steamOnly, results, previous: yesterday, overrides: {} });
    expect(today.items.some((i) => i.sourceId === 'ubisoft-en')).toBe(true);
    expect(today.sources.find((s) => s.sourceId === 'ubisoft-en')?.ok).toBe(false);
    expect(today.editionNumber).toBe(yesterday.editionNumber + 1);
  });
  it('applies editor overrides and can hide items', () => {
    const [a, b] = buildItems();
    const out = applyOverrides([a!, b!], { [a!.id]: { headline_zhHant: '測試' }, [b!.id]: { hide: true } });
    expect(out).toHaveLength(1);
    expect(out[0]!.headline_zhHant).toBe('測試');
  });
});

describe('glossary', () => {
  it('verified terms always cite an official zh-TW Ubisoft source', () => {
    for (const t of glossary.terms) {
      if (t.verified) expect(t.source, t.en).toMatch(/^https:\/\/www\.ubisoft\.com\/zh-tw\//);
    }
  });
});

describe('patch tracker', () => {
  it('reads version, sections, fix counts and number changes from TU notes', async () => {
    const { parsePatch, upsertPatches } = await import('../../pipeline/patches.ts');
    const tu = ubiEn.find((u) => u.externalId === '7L8TlD1Hv0XC1prOD8mdte')!;
    const p = parsePatch(tu)!;
    expect(p.version).toBe('Y8S3.3');
    expect(p.sections).toContain('Crossplay');
    expect(p.fixes).toBeGreaterThan(0);
    expect(p.knownIssues).toBe(1);
    expect(p.changes.some((c) => c.direction === 'up' && /50 to 100/.test(c.text))).toBe(true);
    expect(p.changes.every((c) => wordCount(c.text) <= 25)).toBe(true);
    expect(parsePatch(ubiEn.find((u) => !/TU/.test(u.title))!)).toBeNull();
    expect(upsertPatches([p], [{ ...p, fixes: 99 }])).toHaveLength(1);
  });
});
