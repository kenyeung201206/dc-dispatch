import { MAX_QUOTE_WORDS } from './config.ts';
import type { RawItem } from './sources/types.ts';
import { extractChars, extractWords, hasCJK, toPlainText } from './text.ts';

export interface Summary {
  headline_en: string | 'pending';
  summary_en: string | 'pending';
  headline_zhHant: string | 'pending';
  summary_zhHant: string | 'pending';
  summaryKind: 'original' | 'extract';
}

/** Chinese extracts stay short: roughly the length of a 25-word English quote. */
const MAX_ZH_CHARS = 60;

/**
 * Extractive fallback (no AI key): headline = source title; summary = a short quote
 * from the publisher's own abstract or opening lines (≤ 25 words), shown as a quote.
 * Chinese comes only from Ubisoft's official zh-TW article; otherwise "pending".
 */
export function summarize(primary: RawItem, zh?: RawItem): Summary {
  // Chinese-first sources (巴哈): Chinese now, English "pending" until the AI step translates it.
  if (primary.lang === 'zh') {
    return {
      headline_en: 'pending',
      summary_en: 'pending',
      headline_zhHant: primary.title,
      summary_zhHant: extractChars(primary.text || primary.title, MAX_ZH_CHARS),
      summaryKind: 'extract',
    };
  }
  const enSource = primary.abstract?.trim() || primary.text;
  const summary_en = extractWords(enSource, MAX_QUOTE_WORDS) || primary.title;

  let headline_zhHant: string | 'pending' = 'pending';
  let summary_zhHant: string | 'pending' = 'pending';
  if (zh && hasCJK(zh.title)) {
    headline_zhHant = zh.title;
    const zhText = zh.abstract && hasCJK(zh.abstract) ? zh.abstract : hasCJK(zh.text) ? zh.text : '';
    if (zhText) summary_zhHant = extractChars(zhText, MAX_ZH_CHARS);
  }
  return { headline_en: primary.title, summary_en, headline_zhHant, summary_zhHant, summaryKind: 'extract' };
}

export interface KnownIssue {
  issue: string;
  workaround?: string;
}

/** Read the "Known issues" list from a Markdown patch-notes body. */
export function parseKnownIssues(markdown: string): KnownIssue[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => /^#{1,6}\s*known issues?\b/i.test(l.trim()));
  if (start < 0) return [];
  const out: KnownIssue[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#{1,6}\s/.test(line.trim()) || /^-{3,}\s*$/.test(line.trim())) break;
    const top = line.match(/^[-*]\s+(.+)/);
    const sub = line.match(/^\s{2,}[-*]\s+(.+)/);
    if (top) out.push({ issue: toPlainText(top[1]!) });
    else if (sub && out.length) {
      const text = toPlainText(sub[1]!);
      const w = text.match(/^workaround:\s*(.+)/i);
      if (w) out[out.length - 1]!.workaround = w[1];
    }
  }
  return out.filter((k) => k.issue.length > 10);
}
