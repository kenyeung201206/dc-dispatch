import type { Patch } from '../src/schema/item.ts';
import { MAX_QUOTE_WORDS } from './config.ts';
import type { RawItem } from './sources/types.ts';
import { extractWords, toPlainText } from './text.ts';

const VERSION = /TU ?(Y\d+S\d+(?:\.\d+)?)/i;
const titleCase = (s: string) => s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
const num = (s: string) => Number(s.replace(/[,%\s]/g, ''));

/** Read structured facts from title-update notes (Markdown). Returns null for non-TU posts. */
export function parsePatch(raw: RawItem, itemId?: string): Patch | null {
  const version = raw.title.match(VERSION)?.[1]?.toUpperCase();
  if (!version || !raw.rawBody) return null;
  const lines = raw.rawBody.split(/\r?\n/);

  const sections = lines
    .filter((l) => /^#\s/.test(l))
    .map((l) => toPlainText(l.replace(/\{#\d+\}/g, '')).replace(/:$/, ''))
    .filter((h) => h && !/^contents?$/i.test(h))
    .map(titleCase);

  // Count bullets under a heading (and its sub-headings) until the next heading of the same or higher level.
  const countUnder = (re: RegExp) => {
    let level = 0;
    let n = 0;
    for (const l of lines) {
      const h = l.match(/^(#{1,6})\s+(.*)/);
      if (h) {
        if (re.test(h[2]!)) level = h[1]!.length;
        else if (level && h[1]!.length <= level) level = 0;
        continue;
      }
      if (level && /^[-*]\s+/.test(l)) n++;
    }
    return n;
  };

  const changes: Patch['changes'] = [];
  for (const l of lines) {
    const text = toPlainText(l);
    const m = text.match(/from\s+([\d,.]+%?)\s+to\s+([\d,.]+%?)/i);
    if (!m) continue;
    const a = num(m[1]!);
    const b = num(m[2]!);
    if (Number.isNaN(a) || Number.isNaN(b) || a === b) continue;
    changes.push({ text: extractWords(text, MAX_QUOTE_WORDS), direction: b > a ? 'up' : 'down' });
  }

  return {
    version,
    title: raw.title,
    url: raw.url,
    publishedAt: raw.publishedAt,
    sections,
    fixes: countUnder(/^fixes\b/i),
    knownIssues: countUnder(/^known issues?\b/i),
    changes: changes.slice(0, 12),
    itemId,
  };
}

/** Insert or replace by version; newest first. */
export function upsertPatches(existing: Patch[], found: Patch[]): Patch[] {
  const byVersion = new Map(existing.map((p) => [p.version, p]));
  for (const p of found) byVersion.set(p.version, p);
  return [...byVersion.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
