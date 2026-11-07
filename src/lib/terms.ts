/**
 * Game words the way our readers (and players) say them, applied to every Chinese text on the site:
 * the site's data, Ubisoft's own Chinese, the robot's and the writer's text alike.
 *   高潮任務 (Climax Mission) → 追捕/狩獵任務（Manhunt） the first time in a text, then 追捕任務.
 *   異色零件 / 異彩零件 → 奇特零件, 異色/異彩 weapons and gear → 奇特 (the owner's choice, 2026-11-07).
 * Pure function, no imports: used by the site, the pipeline and scripts.
 */
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
  text = text.replace(EXOTIC, '奇特');
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
