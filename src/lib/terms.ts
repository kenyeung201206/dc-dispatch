/**
 * Game words the way our readers (and players) say them, applied to every Chinese text on the site:
 * the site's data, Ubisoft's own Chinese, the robot's and the writer's text alike.
 *   高潮任務 (Climax Mission) → 追捕/狩獵任務（Manhunt） the first time in a text, then 追捕任務.
 * 奇特 / 奇特零件 stay as they are (the owner's choice, 2026-11-07).
 * Pure function, no imports: used by the site, the pipeline and scripts.
 */
const FULL = '追捕/狩獵任務（Manhunt）';
const SHORT = '追捕任務';
// The old word, with any English name in brackets after it (so it isn't doubled).
const CLIMAX = /高潮任務(?:\s*[（(]\s*Climax(?:\s+Missions?)?\s*[)）])?/gi;

export function zhTerms(text: string): string {
  if (!text || !text.includes('高潮任務')) return text;
  let first = !text.includes(FULL);
  return text.replace(CLIMAX, () => {
    if (first) {
      first = false;
      return FULL;
    }
    return SHORT;
  });
}
