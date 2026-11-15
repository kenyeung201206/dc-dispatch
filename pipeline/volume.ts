/**
 * The owner requires 3–6 new topics per update (DIVISION2_SITE_BRIEF.md §4.3a). One quiet update can happen;
 * three in a row with fewer than 3 means the search or the selection is failing.
 */
export const MIN_NEW_TOPICS = 3;

/** True when each of the last 3 updates brought fewer than MIN_NEW_TOPICS new topics. */
export function lowVolume(recent: number[]): boolean {
  const last = recent.slice(-3);
  return last.length === 3 && last.every((n) => n < MIN_NEW_TOPICS);
}
