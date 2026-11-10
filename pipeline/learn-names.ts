/**
 * Learns Chinese names from 巴哈's daily post. When 巴哈 and ProtoTrack list the same day, they list the same
 * missions in the same order (checked on 11/07, 11/09). If at least 2 positions we already know agree, and
 * none disagree, the unknown English names on ProtoTrack's side get 巴哈's Chinese name at the same position:
 * mission places go to data/places.json, rewards become a Chinese alias in data/brands.json. Nothing is guessed:
 * a name is only learned from a list that lines up with what we already know.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { CJK, nameKey } from './sources/prototrack.ts';

type Entry = { en: string; aliases: string[]; icon: string | null; auto?: boolean };
type Brands = { brands: Entry[]; sets: Entry[]; slots: Entry[] };
type Places = { _note?: string; places: Record<string, string> };

export interface Pair {
  place: string;
  reward: string;
}
export interface Learned {
  places: Record<string, string>;
  rewards: { en: string; zh: string }[];
}

const squash = (s: string) => s.replace(/\s+/g, '').replace(/＆/g, '&');

/** English entry name for a name 巴哈 wrote (exact Chinese alias), or the entry an English name belongs to. */
export function entryFor(brands: Brands, name: string): Entry | undefined {
  const all = [...brands.brands, ...brands.sets, ...brands.slots];
  return CJK.test(name)
    ? all.find((e) => e.aliases.some((a) => squash(a) === squash(name)))
    : all.find((e) => [e.en, ...e.aliases].some((a) => nameKey(a) === nameKey(name)));
}

/** Compares ProtoTrack's English list with 巴哈's Chinese list for the same day. */
export function learnNames(english: Pair[], chinese: Pair[], places: Places, brands: Brands): Learned | undefined {
  if (english.length !== chinese.length || english.length === 0) return undefined;
  const placeZh = (en: string) => Object.entries(places.places).find(([k]) => nameKey(k) === nameKey(en))?.[1];
  let agree = 0;
  for (let i = 0; i < english.length; i++) {
    const en = english[i]!;
    const zh = chinese[i]!;
    const knownPlace = placeZh(en.place);
    if (knownPlace) {
      if (knownPlace !== zh.place) return undefined;
      agree++;
    }
    const theirs = entryFor(brands, zh.reward);
    if (theirs) {
      if (entryFor(brands, en.reward) !== theirs) return undefined;
      agree++;
    }
  }
  if (agree < 2) return undefined;

  const learned: Learned = { places: {}, rewards: [] };
  english.forEach((en, i) => {
    const zh = chinese[i]!;
    if (!placeZh(en.place) && CJK.test(zh.place)) learned.places[en.place] = zh.place;
    const ours = entryFor(brands, en.reward);
    // Only for a name we have an entry (and icon) for, still without a Chinese name, and a Chinese name not used yet.
    if (ours && !ours.aliases.some((a) => CJK.test(a)) && CJK.test(zh.reward) && !entryFor(brands, zh.reward)) {
      learned.rewards.push({ en: ours.en, zh: zh.reward });
    }
  });
  return Object.keys(learned.places).length || learned.rewards.length ? learned : undefined;
}

/** Saves what was learned. Returns a short description for the log. */
export async function saveLearned(learned: Learned, files = { places: 'data/places.json', brands: 'data/brands.json' }): Promise<string[]> {
  const places = JSON.parse(await readFile(files.places, 'utf8')) as Places;
  const brands = JSON.parse(await readFile(files.brands, 'utf8')) as Brands;
  const done: string[] = [];
  for (const [en, zh] of Object.entries(learned.places)) {
    places.places[en] = zh;
    done.push(`${en} = ${zh}`);
  }
  for (const r of learned.rewards) {
    const e = [...brands.brands, ...brands.sets, ...brands.slots].find((x) => x.en === r.en);
    if (!e) continue;
    e.aliases.unshift(r.zh);
    done.push(`${r.en} = ${r.zh}`);
  }
  await writeFile(files.places, JSON.stringify(places, null, 1) + '\n');
  await writeFile(files.brands, JSON.stringify(brands, null, 1) + '\n');
  return done;
}
