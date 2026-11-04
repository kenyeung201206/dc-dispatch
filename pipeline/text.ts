/** Text helpers. All source text is treated as untrusted: we only ever output plain text. */

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

/** Strip HTML, BBCode and Markdown down to plain text. */
export function toPlainText(input: string): string {
  return input
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\{STEAM_CLAN_IMAGE\}\S*/g, ' ')
    // Known BBCode tags only, so titles like "[TUY8S3.3] …" survive.
    .replace(/\[\/?(b|i|u|s|strike|url|img|list|olist|\*|h[1-6]|p|quote|code|table|tr|td|th|hr|spoiler|noparse|previewyoutube|video|carousel)(=[^\]]*)?\]/gi, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // md images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // md links → text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__|`)/g, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/&(#?\w+);/g, (m, e: string) => ENTITIES[e.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

const CJK = /[㐀-鿿豈-﫿]/g;
const CYRILLIC = /[Ѐ-ӿ]/g;

/** Rough language guess, good enough to keep English/Chinese and skip the rest. */
export function detectLang(s: string): 'en' | 'zh' | 'ru' | 'other' {
  const letters = s.replace(/[\s\d\p{P}\p{S}]/gu, '');
  if (!letters) return 'other';
  const cjk = (s.match(CJK) ?? []).length / letters.length;
  const cyr = (s.match(CYRILLIC) ?? []).length / letters.length;
  if (cjk > 0.3) return 'zh';
  if (cyr > 0.3) return 'ru';
  return /^[\x00-\x7F‐-‟À-ſ]*$/.test(letters) ? 'en' : 'other';
}

export const hasCJK = (s: string) => /[㐀-鿿]/.test(s);

/** First ≤ maxWords words, cut at a sentence end when possible, ellipsis if shortened. */
export function extractWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(' ');
  const cut = words.slice(0, maxWords).join(' ');
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > cut.length * 0.5 ? cut.slice(0, end + 1) : `${cut.replace(/[,;:]$/, '')}…`;
}

/** Chinese extract: first sentence(s) up to maxChars. */
export function extractChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const end = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('！'), cut.lastIndexOf('？'));
  return end > maxChars * 0.4 ? cut.slice(0, end + 1) : `${cut}…`;
}

export const normTitle = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);

/** Jaccard similarity of title tokens, 0..1. */
export function titleSimilarity(a: string, b: string): number {
  const A = new Set(normTitle(a));
  const B = new Set(normTitle(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export function stableId(...parts: string[]): string {
  let h = 2166136261;
  for (const ch of parts.join('|')) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36);
}
