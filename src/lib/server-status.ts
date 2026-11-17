/**
 * Division 2 server status for the banner badge, from announcements (Ubisoft keeps its live status feed private).
 * Source: 巴哈's 「關機維護公告」 threads on the Division board, which players keep up to date:
 *   【情報】關機維護公告 - 2026/11/12(四) 16:30           → maintenance announced, starts 16:30 Taiwan time
 *   【情報】【已開機】關機維護公告 - 2026/11/10(二) 16:30，延長 1 小時   → done (servers back), it ran 1 h longer
 *   【情報】【加碼維護】關機維護公告 - 2026/11/17(二) ， 開機後再次加碼進入維修 → extra maintenance, still going on
 *   first post: 「關機維護時間：2026 年 11 月 17 日 15:00 開始維護」「預計維護 8 小時」 → start (when the title has
 *   only a date) and planned length
 * Shared by functions/api/server-status.ts (live, cached 5 min) and the tests. Pure, no I/O.
 */

export type ServerState = 'normal' | 'scheduled' | 'maintenance' | 'unknown';

export interface Maintenance {
  /** Start, ISO (UTC). */
  start: string;
  /** Servers back (【已開機】). */
  done: boolean;
  /** Hours added later (「延長 1.5 小時」). */
  extendHours: number;
  /** Extended with no end given (【加碼維護】/【延長維護】/【維護中】): ongoing until the title says 【已開機】. */
  extendedOpen?: boolean;
  /** False when the title had only a date: the start time comes from the post (parseBodyStart). */
  timeKnown?: boolean;
  url?: string;
}

export interface ServerStatus {
  state: ServerState;
  /** For scheduled / maintenance: ISO start and expected end (end may be missing when the length is unknown). */
  start?: string;
  end?: string;
  /** The announcement it comes from. */
  url?: string;
  /** Why the state is unknown (fetch failed, 巴哈 refused…). */
  reason?: string;
}

const TW = 8 * 3_600_000;
/** A maintenance with no known length counts as ongoing for at most this long, unless marked 【已開機】 earlier. */
export const MAX_UNKNOWN_HOURS = 8;
/** Announced maintenance is shown from this far ahead. */
export const SHOW_AHEAD_HOURS = 72;

/** A maintenance announcement title → start time (Taiwan time in the title), done flag, extension. */
export function parseMaintenanceTitle(title: string): Maintenance | undefined {
  if (!/維護公告|停機維護|關機維護/.test(title)) return undefined;
  const date = /(\d{4})\s*[/\-.年]\s*(\d{1,2})\s*[/\-.月]\s*(\d{1,2})/.exec(title);
  if (!date) return undefined;
  const time = /(\d{4})\s*[/\-.年]\s*(\d{1,2})\s*[/\-.月]\s*(\d{1,2})[^\d]{0,12}?(\d{1,2})\s*[:：]\s*(\d{2})/.exec(title);
  const [, y, mo, d] = date.map(Number) as number[];
  const [h, mi] = time ? [Number(time[4]), Number(time[5])] : [0, 0];
  const start = new Date(Date.UTC(y!, mo! - 1, d!, h, mi) - TW).toISOString();
  const ext = /延長\s*([\d.]+)\s*(?:個)?小時/.exec(title);
  const done = /已開機|已開服|維護結束|維護完成/.test(title);
  return {
    start,
    done,
    extendHours: ext ? Number(ext[1]) : 0,
    ...(!done && /加碼維護|延長維護|維護中|再次.{0,4}維/.test(title) ? { extendedOpen: true } : {}),
    ...(time ? {} : { timeKnown: false }),
  };
}

/** Planned length from the post: 「預計維護 6 小時」/「預計停機 2.5 小時」, else "Estimated downtime is 6 hours". */
export function parseDurationHours(text: string): number | undefined {
  const zh = /預計(?:維護|停機|關機)(?:時間)?(?:約|為)?\s*([\d.]+)\s*(?:個)?小時/.exec(text);
  if (zh) return Number(zh[1]);
  const en = /estimated downtime (?:is|of)?\s*(?:about\s*)?([\d.]+)\s*hours?/i.exec(text);
  return en ? Number(en[1]) : undefined;
}

/** Start time written in the post: 「關機維護時間：2026 年 11 月 17 日 15:00」 (Taiwan time) → ISO, or undefined. */
export function parseBodyStart(text: string): string | undefined {
  const m = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日[^\d]{0,6}(\d{1,2})\s*[:：]\s*(\d{2})/.exec(text);
  if (!m) return undefined;
  const [, y, mo, d, h, mi] = m.map(Number) as number[];
  return new Date(Date.UTC(y!, mo! - 1, d!, h!, mi!) - TW).toISOString();
}

/** What the badge shows at `now` for the newest announced maintenance (or none). */
export function statusAt(m: Maintenance | undefined, durationHours: number | undefined, now: Date): ServerStatus {
  if (!m) return { state: 'normal' };
  const start = Date.parse(m.start);
  const hours = durationHours !== undefined ? durationHours + m.extendHours : undefined;
  const end = hours !== undefined ? start + hours * 3_600_000 : undefined;
  const t = now.getTime();
  const base = { start: m.start, ...(end ? { end: new Date(end).toISOString() } : {}), ...(m.url ? { url: m.url } : {}) };
  if (m.done) return { state: 'normal' };
  if (t < start) return t >= start - SHOW_AHEAD_HOURS * 3_600_000 ? { state: 'scheduled', ...base } : { state: 'normal' };
  // Extended with no end given: ongoing until 【已開機】, for at most MAX_UNKNOWN_HOURS past the planned end.
  const over = m.extendedOpen ? (end ?? start) + MAX_UNKNOWN_HOURS * 3_600_000 : (end ?? start + MAX_UNKNOWN_HOURS * 3_600_000);
  if (t >= over) return { state: 'normal' };
  return m.extendedOpen ? { state: 'maintenance', start: m.start, ...(m.url ? { url: m.url } : {}) } : { state: 'maintenance', ...base };
}

/** The newest maintenance announcement among board titles (by its start time). */
export function newestMaintenance(items: { title: string; url: string }[]): Maintenance | undefined {
  return items
    .flatMap((i): Maintenance[] => {
      const m = parseMaintenanceTitle(i.title);
      return m ? [{ ...m, url: i.url }] : [];
    })
    .sort((a, b) => b.start.localeCompare(a.start))[0];
}
