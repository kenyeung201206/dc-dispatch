/**
 * Keeps data/daily-loot.json (the 今日戰鬥升級 box) current. ProtoTrack.gg first: it has the new list ~2 min
 * after the 08:00 UTC reset. 巴哈's daily post is the backup (updated by hand, usually ~3 h after reset), and is
 * used only when it is newer than what we already have, so it never replaces a newer ProtoTrack list.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { politeGet } from './http.ts';
import { entryFor, learnNames, saveLearned } from './learn-names.ts';
import { log } from './log.ts';
import { addMissingIcons } from './loot-icons.ts';
import { dailyDate, parseDailyLoot, type DailyLoot } from './sources/bahamut-daily.ts';
import { CJK, lootDay, parseProtoTrack, parseProtoTrackEnglish, PROTOTRACK_PAGE, PROTOTRACK_TXT } from './sources/prototrack.ts';

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
  const fresh = await fromSources(now, bahamut);
  const learned = bahamut ? await learnFromBahamut(now, bahamut).catch((err) => log('warn', 'name learning failed', { error: String(err).slice(0, 120) })) : undefined;
  return fresh ?? learned ?? undefined;
}

async function fromSources(now: Date, bahamut?: { title: string; url: string }): Promise<string | undefined> {
  const have = (await current()).date ?? '';
  try {
    const txt = await politeGet(PROTOTRACK_TXT, { retries: 1 });
    const pt = parseProtoTrack(txt);
    // A date in the future would be a typo on their side; skip it rather than show it early.
    if (pt && pt.date > have && pt.date <= lootDay(now)) {
      const english = parseProtoTrackEnglish(txt)!.missions;
      await save({ ...pt, english, title: '', url: PROTOTRACK_PAGE, source: 'prototrack', fetchedAt: now.toISOString() });
      log('info', 'daily loot', { source: 'prototrack', date: pt.date, missions: pt.missions.length });
      // A name we don't know yet: take its icon from ProtoTrack (the Chinese name is added by hand later).
      await addMissingIcons([...pt.missions.map((m) => m.reward), ...pt.vendor]).catch((err) =>
        log('warn', 'loot icons failed', { error: String(err).slice(0, 120) }),
      );
      return pt.date;
    }
    if (!pt) log('warn', 'daily loot: ProtoTrack layout not recognised', {});
    // Same day, saved before English names were kept: add them so 巴哈's names can be learned today.
    const saved = await current();
    if (pt && pt.date === have && saved.source === 'prototrack' && !saved.english) {
      await save({ ...(saved as DailyLoot), english: parseProtoTrackEnglish(txt)!.missions });
    }
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

/**
 * When today's ProtoTrack list still has English names and 巴哈's post for the same day is up, learn the Chinese
 * names from it (pipeline/learn-names.ts) and show them in today's box. Returns the date when the box changed.
 */
async function learnFromBahamut(now: Date, bahamut: { title: string; url: string }): Promise<string | undefined> {
  const saved = await current();
  const unknown = saved.missions?.some((m) => !CJK.test(m.place) || !CJK.test(m.reward));
  if (saved.source !== 'prototrack' || !saved.english || !unknown || dailyDate(bahamut.title, now) !== saved.date) return undefined;
  const baha = parseDailyLoot(await politeGet(bahamut.url));
  if (!baha) return undefined;
  const learned = learnNames(
    saved.english,
    baha.missions,
    JSON.parse(await readFile('data/places.json', 'utf8')),
    JSON.parse(await readFile('data/brands.json', 'utf8')),
  );
  if (!learned) {
    log('info', 'name learning: lists do not line up, nothing learned', { date: saved.date });
    return undefined;
  }
  log('info', 'learned Chinese names from 巴哈', { names: await saveLearned(learned) });
  // Show them in today's box straight away (the next ProtoTrack list picks them up from the data files).
  const brands = JSON.parse(await readFile('data/brands.json', 'utf8'));
  const missions = saved.missions!.map((m, i) => {
    const en = saved.english![i]!;
    const learnedReward = learned.rewards.find((r) => r.en === entryFor(brands, en.reward)?.en)?.zh;
    return { ...m, place: learned.places[en.place] ?? m.place, reward: learnedReward ?? m.reward };
  });
  await save({ ...(saved as DailyLoot), missions });
  return saved.date;
}
