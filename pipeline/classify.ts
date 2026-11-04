import type { Category } from '../src/schema/item.ts';
import { CATEGORY_RULES } from './config.ts';

const TAG_RULES: [string, RegExp][] = [
  ['title-update', /\b(title update|TU ?Y\d+S\d+)/i],
  ['crossplay', /\bcrossplay\b/i],
  ['dlc', /\b(dlc|expansion)\b/i],
  ['event', /\bevent\b/i],
  ['twitch-drops', /\btwitch drops?\b/i],
  ['exotic', /\bexotic\b/i],
  ['pvp', /\b(pvp|conflict|dark zone)\b/i],
  ['known-issue', /\bknown issues?\b/i],
  ['season', /\bseason\b/i],
];

/** Title decides first (it's what the story is about); body text only breaks ties. */
export function classify(title: string, text: string): Category {
  for (const { category, pattern } of CATEGORY_RULES) if (pattern.test(title)) return category;
  const head = text.slice(0, 600);
  for (const { category, pattern } of CATEGORY_RULES) {
    if (category === 'glitch-watch') continue; // patch notes always mention bugs; don't misfile them
    if (pattern.test(head)) return category;
  }
  return 'community';
}

export function tagsFor(title: string, text: string): string[] {
  const hay = `${title} ${text.slice(0, 1500)}`;
  return TAG_RULES.filter(([, re]) => re.test(hay)).map(([t]) => t);
}
