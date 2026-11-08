/**
 * Keeps data/daily-loot.json (the 今日戰鬥升級 box) current. ProtoTrack.gg first: it has the new list ~2 min
 * after the 08:00 UTC reset. 巴哈's daily post is the backup (updated by hand, usually ~3 h after reset), and is
 * used only when it is newer than what we already have, so it never replaces a newer ProtoTrack list.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { politeGet } from './http.ts';
import { log } from './log.ts';
import { dailyDate, parseDailyLoot, type DailyLoot } from './sources/bahamut-daily.ts';
import { lootDay, parseProtoTrack, PROTOTRACK_PAGE, PROTOTRACK_TXT } from './sources/prototrack.ts';

export const LOOT_FILE = 'data/daily-loot.json';

async function current(): Promise<Partial<DailyLoot>> {
  try {
    return JSON.parse(await readFile(LOOT_FILE, 'utf8')) as Partial<DailyLoot>;
  } catch {
    return {};
  }
}

const save = (loot: DailyLoot) => writeFile(LOOT_FILE, JSON.stringify(loot, null, 1) + '\n');

/**
 * Fetches the newest list and saves it if it is newer than the saved one.
 * `bahamut` is 巴哈's daily thread from the board list (title + link), when the caller has it.
 * Returns the saved list's date, or undefined when nothing changed.
 */
export async function updateDailyLoot(now: Date, bahamut?: { title: string; url: string }): Promise<string | undefined> {
  const have = (await current()).date ?? '';
  try {
    const pt = parseProtoTrack(await politeGet(PROTOTRACK_TXT, { retries: 1 }));
    // A date in the future would be a typo on their side; skip it rather than show it early.
    if (pt && pt.date > have && pt.date <= lootDay(now)) {
      await save({ ...pt, title: '', url: PROTOTRACK_PAGE, source: 'prototrack', fetchedAt: now.toISOString() });
      log('info', 'daily loot', { source: 'prototrack', date: pt.date, missions: pt.missions.length });
      return pt.date;
    }
    if (!pt) log('warn', 'daily loot: ProtoTrack layout not recognised', {});
  } catch (err) {
    log('warn', 'daily loot: ProtoTrack fetch failed', { error: String(err).slice(0, 120) });
  }
  const date = bahamut && dailyDate(bahamut.title, now);
  if (!bahamut || !date || date <= have) return undefined;
  try {
    const loot = parseDailyLoot(await politeGet(bahamut.url));
    if (!loot) {
      log('warn', 'daily loot: 巴哈 layout not recognised', {});
      return undefined;
    }
    await save({ date, title: bahamut.title, url: bahamut.url, source: 'bahamut', ...loot, fetchedAt: now.toISOString() });
    log('info', 'daily loot', { source: 'bahamut', date, missions: loot.missions.length });
    return date;
  } catch (err) {
    log('warn', 'daily loot: 巴哈 fetch failed', { error: String(err).slice(0, 120) });
    return undefined;
  }
}
