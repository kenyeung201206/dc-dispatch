import type { Item } from '../src/schema/item.ts';
import { CONFIDENCE_BASE, KEYWORD_WEIGHTS } from './config.ts';

/**
 * Importance 0–100 = confidence base + recency (up to 30, fading over 14 days)
 * + corroboration (+8 per extra outlet, max 16) + keyword bonuses (max 30).
 */
export function score(
  item: Pick<Item, 'confidence' | 'publishedAt' | 'headline_en' | 'summary_en'>,
  extraSources: number,
  now: Date,
): number {
  const ageDays = Math.max(0, (now.getTime() - Date.parse(item.publishedAt)) / 86_400_000);
  const recency = Math.max(0, 30 * (1 - ageDays / 14));
  const corroboration = Math.min(16, extraSources * 8);
  const hay = `${item.headline_en} ${item.summary_en}`;
  const keywords = Math.min(30, KEYWORD_WEIGHTS.reduce((s, [re, w]) => s + (re.test(hay) ? w : 0), 0));
  return Math.round(Math.min(100, CONFIDENCE_BASE[item.confidence] + recency + corroboration + keywords));
}
