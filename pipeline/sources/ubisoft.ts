import { z } from 'zod';
import { SOURCES } from '../config.ts';
import { toPlainText } from '../text.ts';
import type { RawItem } from './types.ts';

/**
 * Pull the JSON object assigned to window.__PRELOADED_STATE__ out of the page.
 * Parsed with JSON.parse (never eval) by scanning to the matching closing brace.
 */
export function extractPreloadedState(html: string): unknown {
  const marker = html.indexOf('window.__PRELOADED_STATE__');
  if (marker < 0) throw new Error('No __PRELOADED_STATE__ in page (layout changed?)');
  const start = html.indexOf('{', marker);
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON.parse(html.slice(start, i + 1));
  }
  throw new Error('Unterminated __PRELOADED_STATE__');
}

const Article = z.object({
  id: z.string().min(1),
  type: z.string(),
  title: z.string().min(1),
  date: z.string(),
  abstract: z.string().nullish(),
  content: z.string().nullish(),
  thumbnail: z.object({ url: z.string() }).nullish(),
  button: z.object({ buttonUrl: z.string() }),
});

/** Find every article-shaped object anywhere in the state (robust to small layout changes). */
function findArticles(node: unknown, out: unknown[] = []): unknown[] {
  if (Array.isArray(node)) node.forEach((n) => findArticles(n, out));
  else if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    if (o.id && o.title && o.date && o.button) out.push(o);
    else Object.values(o).forEach((v) => findArticles(v, out));
  }
  return out;
}

const SAFE_PATH = /^\/[A-Za-z0-9_-]+\/[a-z0-9-]+$/;
const SAFE_IMG = /^https:\/\/staticctf\.ubisoft\.com\//;

export function parseUbisoftNews(html: string, sourceId: 'ubisoft-en' | 'ubisoft-zh-tw'): RawItem[] {
  const locale = sourceId === 'ubisoft-en' ? 'en-us' : 'zh-tw';
  const base = `https://www.ubisoft.com/${locale}/game/the-division/the-division-2/news-updates`;
  const seen = new Set<string>();
  const out: RawItem[] = [];
  for (const candidate of findArticles(extractPreloadedState(html))) {
    const parsed = Article.safeParse(candidate);
    if (!parsed.success) continue;
    const a = parsed.data;
    if (a.type !== 'news' || seen.has(a.id)) continue; // videos are handled in Watch Now (Phase 5)
    if (!SAFE_PATH.test(a.button.buttonUrl)) continue;
    const published = new Date(a.date);
    if (Number.isNaN(published.getTime())) continue;
    seen.add(a.id);
    const body = a.content ?? '';
    out.push({
      sourceId,
      sourceName: SOURCES[sourceId].name,
      externalId: a.id,
      url: `${base}${a.button.buttonUrl}`,
      title: toPlainText(a.title),
      text: toPlainText(body),
      rawBody: body,
      abstract: a.abstract ? toPlainText(a.abstract) : undefined,
      publishedAt: published.toISOString(),
      lang: sourceId === 'ubisoft-en' ? 'en' : 'zh',
      confidence: 'official',
      imageUrl: a.thumbnail?.url && SAFE_IMG.test(a.thumbnail.url) ? a.thumbnail.url : undefined,
    });
  }
  return out;
}
