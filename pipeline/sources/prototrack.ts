/**
 * ProtoTrack.gg's plain-text daily file: today's 戰鬥升級 (Escalation) targeted loot and the 原型箱商人 caches,
 * usually saved within ~2 minutes of the daily reset (08:00 UTC = 16:00 Taiwan/HK time). robots.txt allows everything.
 * Community-kept (players read it in-game; Ubisoft publishes no list). We keep only the facts: mission → reward.
 * English names become the Chinese names 巴哈 posts use (data/brands.json); unknown names stay in English.
 */
import brands from '../../data/brands.json' with { type: 'json' };
import places from '../../data/places.json' with { type: 'json' };
import type { DailyLoot, RewardKind } from './bahamut-daily.ts';

export const PROTOTRACK_TXT = 'https://prototrack.gg/target-loot/target-loot-current.txt';
export const PROTOTRACK_PAGE = 'https://prototrack.gg/target-loot/target-loot.php';

/** "Negotiators Dilemma" = "Negotiator's Dilemma", "Kneepad" = "Kneepads", "SMGs" = "SMG". */
export const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/s$/, '');
const key = nameKey;
/** Mission names as 巴哈's daily post writes them (data/places.json; the robot learns new ones). */
const PLACE: Record<string, string> = Object.fromEntries(
  // 巴哈's own names win over full names from other sources.
  Object.entries({ ...(places.fromOtherSources as Record<string, string>), ...(places.places as Record<string, string>) }).map(([en, zh]) => [key(en), zh]),
);
export const CJK = /[㐀-鿿]/;

type Entry = { en: string; aliases: string[]; icon: string | null };
const LISTS: [RewardKind, Entry[]][] = [
  ['brand', brands.brands],
  ['set', brands.sets],
  ['slot', brands.slots],
];

/** True when data/brands.json has this English (or Chinese) name. */
export const knownReward = (name: string) => LISTS.some(([, list]) => list.some((e) => [e.en, ...e.aliases].some((a) => key(a) === key(name))));

/** English reward name → the Chinese name players use, and its type. */
export function chineseReward(name: string): { reward: string; kind: RewardKind } {
  for (const [kind, list] of LISTS) {
    const hit = list.find((e) => [e.en, ...e.aliases].some((a) => key(a) === key(name)));
    if (hit) {
      // Weapons are kept in the slot list; other items (gear mods) aren't a gear slot.
      const k = hit.icon?.startsWith('/icons/weapon/') ? 'weapon' : hit.icon?.startsWith('/icons/gear/') ? 'other' : kind;
      return { reward: hit.aliases.find((a) => CJK.test(a)) ?? hit.en, kind: k };
    }
  }
  return { reward: name, kind: 'other' };
}

/** Reads the text file. Returns undefined if it doesn't look like the expected layout. */
export function parseProtoTrack(txt: string): Pick<DailyLoot, 'date' | 'missions' | 'vendor'> | undefined {
  const raw = parseProtoTrackEnglish(txt);
  if (!raw) return undefined;
  return {
    date: raw.date,
    missions: raw.missions.map((m) => ({ place: PLACE[key(m.place)] ?? m.place, ...chineseReward(m.reward) })),
    vendor: raw.vendor.map((v) => chineseReward(v).reward),
  };
}

/** The file as ProtoTrack wrote it (English names), for matching against 巴哈's list. */
export function parseProtoTrackEnglish(txt: string): { date: string; missions: { place: string; reward: string }[]; vendor: string[] } | undefined {
  const date = /^Date:\s*(\d{4}-\d{2}-\d{2})\s*$/m.exec(txt)?.[1];
  const section = (name: string) => {
    const at = txt.search(new RegExp(`^${name}:\\s*$`, 'm'));
    if (at < 0) return [];
    const lines = txt.slice(at).split(/\r?\n/).slice(1);
    const end = lines.findIndex((l) => !/^\s*-\s/.test(l));
    return (end < 0 ? lines : lines.slice(0, end)).map((l) => /^\s*-\s*([^:]+):\s*(.+?)\s*$/.exec(l)).filter((m) => !!m);
  };
  const missions = section('Missions').map(([, place, reward]) => ({ place: place!.trim(), reward: reward!.trim() }));
  const vendor = section('Vendor Caches').map(([, , item]) => item!.trim());
  if (!date || !missions.length || missions.length > 12) return undefined;
  return { date, missions, vendor };
}

/** The game day running now: the daily loot changes at 08:00 UTC, so 07:59 UTC still belongs to yesterday. */
export function lootDay(now: Date): string {
  return new Date(now.getTime() - 8 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * True when the box still shows an older day's list 4+ hours after the reset (20:00 Taiwan/HK time or later).
 * Only for the first 2 hours after that, so the watchdog (every 2 h at :50) emails once a day, not all night.
 */
export function lootIsLate(saved: string, now: Date): boolean {
  const sinceReset = (now.getTime() - Date.parse(`${lootDay(now)}T08:00:00Z`)) / 3_600_000;
  return saved < lootDay(now) && sinceReset >= 4 && sinceReset < 6;
}
