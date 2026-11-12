/**
 * Shared by the 今日戰鬥升級 box (DailyLoot.astro, at build time) and /api/loot (live, after the 16:00 Taiwan/HK time reset):
 * a reward name → English name, in-game icon and tint. A name we can't match with confidence gets no icon.
 */
import brands from '../../data/brands.json' with { type: 'json' };

type Entry = { en: string; aliases: string[]; icon: string | null };
const norm = (s: string) => s.replace(/\s+/g, '').replace(/＆/g, '&');
const find = (list: Entry[], name: string) => list.find((b) => b.aliases.some((a) => norm(a) === norm(name)));
const LISTS = { brand: brands.brands, set: brands.sets, slot: brands.slots } as Record<string, Entry[]>;

export interface RewardMatch {
  en: string;
  icon: string | null;
  /** Gear sets are green in game; brands, slots and weapons white. */
  tint: 'set' | 'white';
}

/** The poster's cell colour (kind) says which list to look in; any other kind may be in any list. */
export function matchReward(name: string, kind: string): RewardMatch | undefined {
  for (const k of LISTS[kind] ? [kind] : ['brand', 'set', 'slot']) {
    const hit = find(LISTS[k]!, name);
    if (hit) return { en: hit.en, icon: hit.icon, tint: k === 'set' ? 'set' : 'white' };
  }
  return undefined;
}

export const LOOT_KINDS = ['brand', 'set', 'slot', 'weapon'] as const;
