/**
 * Game words the way our readers (and players) say them, applied to every Chinese text on the site:
 * the site's data, Ubisoft's own Chinese, the robot's and the writer's text alike.
 *   高潮任務 (Climax Mission) → 追捕/狩獵任務（Manhunt） the first time in a text, then 追捕任務.
 *   異色零件 / 異彩零件 → 奇特零件, 異色/異彩 weapons and gear → 奇特 (the owner's choice, 2026-11-07).
 *   An English game term gets its Chinese name after it the first time: Forward Observer（前進觀測員）, so readers
 *   who don't know the English name still understand (the owner's request, 2026-11-14). Names: data/term-names.json.
 * Pure functions (one data import): used by the site, the pipeline and scripts.
 */
import termNames from '../../data/term-names.json' with { type: 'json' };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Longest first, so "Perfect Technophobia" is handled before "Technophobia". */
const NAMES = (termNames.terms as { en: string; zh: string }[])
  .slice()
  .sort((a, b) => b.en.length - a.en.length)
  // Whole words only, any letter case; not when a Chinese name in brackets already follows.
  .map((t) => ({ zh: t.zh, re: new RegExp(`(?<![A-Za-z0-9'’])${esc(t.en)}(?![A-Za-z0-9'’])(?!\\s*[（(][^)）]*[\u3400-\u9fff])`, 'i') }));

/** Adds （中文） after the first English mention of each known game term, unless the Chinese name is already there. */
export function addChineseNames(text: string): string {
  if (!text || !/[A-Za-z]/.test(text)) return text;
  for (const { zh, re } of NAMES) {
    if (text.includes(zh)) continue;
    text = text.replace(re, (m) => `${m}（${zh}）`);
  }
  return text;
}

const FULL = '追捕/狩獵任務（Manhunt）';
const SHORT = '追捕任務';
// The old word, with any English name in brackets after it (so it isn't doubled).
const CLIMAX = /高潮任務(?:\s*[（(]\s*Climax(?:\s+Missions?)?\s*[)）])?/gi;

/**
 * Other words for "exotic" (異色 / 異彩, Traditional or Simplified) → 奇特, which our readers use.
 * Only before game-item words, so ordinary uses of 異色 (a colour) are left alone.
 */
const EXOTIC = /[異异](?:色|彩)(?=零件|武器|裝備|装备|物品|手套|護甲|护甲|背包|面具|護膝|胸甲|槍套|步槍|步枪|霰彈槍|狙擊槍|衝鋒槍|機槍|手槍|寶箱|箱|天賦|槍|枪)/g;

export function zhTerms(text: string): string {
  if (!text) return text;
  text = addChineseNames(text.replace(EXOTIC, '奇特'));
  if (!text.includes('高潮任務')) return text;
  let first = !text.includes(FULL);
  return text.replace(CLIMAX, () => {
    if (first) {
      first = false;
      return FULL;
    }
    return SHORT;
  });
}
