import { describe, expect, it } from 'vitest';
import { newestMaintenance, parseDurationHours, parseMaintenanceTitle, statusAt } from '../../src/lib/server-status.ts';

// Real 巴哈 titles and post text (2026-11).
const DONE = '【情報】【已開機】關機維護公告 - 2026/11/10(二) 16:30，延長 1 小時';
const NOV3 = '【情報】【已開機】關機維護公告 - 2026/11/03(二) 16:00 (Y8S3.3 中央公園DLC)，延長1.5小時';
const UPCOMING = '【情報】關機維護公告 - 2026/11/20(四) 16:00 (Y8S4)';
const BODY = '關機維護時間：2026 年 11 月 12 日 16:30 開始維護\n預計維護 6 小時\n本次維護將包含以下項目';

describe('server status badge from 巴哈 maintenance announcements', () => {
  it('reads start (Taiwan time), done and extension from the title', () => {
    expect(parseMaintenanceTitle(DONE)).toEqual({ start: '2026-11-10T08:30:00.000Z', done: true, extendHours: 1 });
    expect(parseMaintenanceTitle(NOV3)).toEqual({ start: '2026-11-03T08:00:00.000Z', done: true, extendHours: 1.5 });
    expect(parseMaintenanceTitle(UPCOMING)).toEqual({ start: '2026-11-20T08:00:00.000Z', done: false, extendHours: 0 });
    expect(parseMaintenanceTitle('【情報】TU30 / Y8S4 PTS Patchnote翻譯')).toBeUndefined();
  });
  it('reads the planned length from the post', () => {
    expect(parseDurationHours(BODY)).toBe(6);
    expect(parseDurationHours('Thursday, November 12 Estimated downtime is 6 hours')).toBe(6);
    expect(parseDurationHours('沒有時間')).toBeUndefined();
  });
  it('scheduled → maintenance → normal, on the minute', () => {
    const m = parseMaintenanceTitle(UPCOMING)!;
    expect(statusAt(m, 6, new Date('2026-11-18T08:00:00Z')).state).toBe('scheduled'); // 2 days ahead
    expect(statusAt(m, 6, new Date('2026-11-14T08:00:00Z')).state).toBe('normal'); // too far ahead to show
    expect(statusAt(m, 6, new Date('2026-11-20T07:59:00Z')).state).toBe('scheduled');
    expect(statusAt(m, 6, new Date('2026-11-20T08:00:00Z'))).toMatchObject({ state: 'maintenance', end: '2026-11-20T14:00:00.000Z' });
    expect(statusAt(m, 6, new Date('2026-11-20T14:00:00Z')).state).toBe('normal');
    expect(statusAt({ ...m, extendHours: 1 }, 6, new Date('2026-11-20T14:30:00Z')).state).toBe('maintenance');
  });
  it('done (【已開機】) is normal at once; unknown length ends after 8 h at most', () => {
    expect(statusAt(parseMaintenanceTitle(DONE)!, 6, new Date('2026-11-10T09:00:00Z')).state).toBe('normal');
    const m = parseMaintenanceTitle(UPCOMING)!;
    expect(statusAt(m, undefined, new Date('2026-11-20T15:00:00Z')).state).toBe('maintenance');
    expect(statusAt(m, undefined, new Date('2026-11-20T16:01:00Z')).state).toBe('normal');
  });
  it('picks the newest announcement', () => {
    expect(newestMaintenance([{ title: DONE, url: 'a' }, { title: UPCOMING, url: 'b' }, { title: 'other', url: 'c' }])?.url).toBe('b');
    expect(newestMaintenance([])).toBeUndefined();
  });
});

describe('extra maintenance with no end, and start time only in the post (real 2026-11-17 case)', async () => {
  const { parseBodyStart } = await import('../../src/lib/server-status.ts');
  const EXTRA = '【情報】【加碼維護】關機維護公告 - 2026/11/17(二) ， 開機後再次加碼進入維修';
  const POST = '關機維護時間：2026 年 11 月 17 日 15:00 開始維護 預計維護 8 小時 … 延長賽，加碼維護';
  it('reads the date-only title, then the start time from the post', () => {
    const m = parseMaintenanceTitle(EXTRA)!;
    expect(m).toMatchObject({ done: false, extendedOpen: true, timeKnown: false });
    expect(parseBodyStart(POST)).toBe('2026-11-17T07:00:00.000Z');
    expect(parseDurationHours(POST)).toBe(8);
  });
  it('stays "maintenance" past the planned 8 h while the title says 加碼維護, up to 8 h more', () => {
    const m = { ...parseMaintenanceTitle(EXTRA)!, start: '2026-11-17T07:00:00.000Z' };
    expect(statusAt(m, 8, new Date('2026-11-17T15:48:00Z')).state).toBe('maintenance'); // after the planned end
    expect(statusAt(m, 8, new Date('2026-11-17T23:01:00Z')).state).toBe('normal'); // safety limit
    expect(statusAt({ ...m, done: true, extendedOpen: undefined }, 8, new Date('2026-11-17T15:48:00Z')).state).toBe('normal'); // 【已開機】
  });
});
