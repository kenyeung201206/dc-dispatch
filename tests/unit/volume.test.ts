import { describe, expect, it } from 'vitest';
import { lowVolume, MIN_NEW_TOPICS } from '../../pipeline/volume.ts';

describe('update volume: 3–6 new topics per update (DIVISION2_SITE_BRIEF.md §4.3a)', () => {
  it('flags three low updates in a row', () => {
    expect(MIN_NEW_TOPICS).toBe(3);
    expect(lowVolume([5, 1, 2, 1])).toBe(true);
    expect(lowVolume([1, 1, 4])).toBe(false); // the latest one was fine
    expect(lowVolume([0, 2])).toBe(false); // not enough history yet
    expect(lowVolume([3, 6, 4])).toBe(false);
  });
});
