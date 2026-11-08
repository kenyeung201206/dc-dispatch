/**
 * 巴哈's pinned daily thread 「【情報】MM/DD 每日戰鬥升級掉落 & 原型商人」: its first post holds two small tables,
 * today's 戰鬥升級 targeted loot (mission → reward) and the 原型箱商人 item. We keep only those facts (place
 * names, reward names, the date), never the post text or the poster's name.
 * The poster colours each reward cell by type: yellow = brand, green = gear set, white = gear slot.
 */
import { toPlainText } from '../text.ts';

export type RewardKind = 'brand' | 'set' | 'slot' | 'weapon' | 'other';
export interface DailyLoot {
  /** Day the post is for, from its title ("11/07" → "2026-11-07"). */
  date: string;
  title: string;
  url: string;
  /** Where the list came from: ProtoTrack.gg (fast, ~2 min after reset) or 巴哈's post (backup). */
  source: 'prototrack' | 'bahamut';
  missions: { place: string; reward: string; kind: RewardKind }[];
  vendor: string[];
  fetchedAt: string;
}

const KIND: Record<string, RewardKind> = { ffcc00: 'brand', '99cc00': 'set', ffffff: 'slot' };

function rows(table: string): { text: string; color: string }[][] {
  return [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) =>
    [...r[1]!.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)].map((c) => ({
      text: toPlainText(c[2]!.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(),
      color: (/bgcolor\s*=\s*"?#?([0-9a-f]{6})/i.exec(c[1]!)?.[1] ?? '').toLowerCase(),
    })),
  );
}

/** Reads the first post. Returns undefined if the layout isn't the expected two tables. */
export function parseDailyLoot(html: string): Pick<DailyLoot, 'missions' | 'vendor'> | undefined {
  const post = /<div class="c-article__content">([\s\S]*?)<\/article>/.exec(html)?.[1];
  if (!post) return undefined;
  const lootAt = post.search(/今日抽獎|戰鬥升級/);
  const vendorAt = post.search(/原型箱商人|原型商人/);
  const tables = [...post.matchAll(/<table[\s\S]*?<\/table>/gi)].map((m) => ({ at: m.index ?? 0, html: m[0] }));
  const loot = tables.find((t) => t.at > lootAt && (vendorAt < 0 || t.at < vendorAt));
  const vendor = vendorAt >= 0 ? tables.find((t) => t.at > vendorAt) : undefined;
  if (!loot) return undefined;
  const missions = rows(loot.html)
    .filter((r) => r.length >= 2 && r[0]!.text && r[1]!.text)
    .map((r) => ({ place: r[0]!.text, reward: r[1]!.text, kind: KIND[r[1]!.color] ?? 'other' }));
  if (!missions.length || missions.length > 12) return undefined;
  return { missions, vendor: vendor ? rows(vendor.html).flat().map((c) => c.text).filter(Boolean) : [] };
}

/** "【情報】11/07 每日戰鬥升級掉落 …" → "2026-11-07" (year from `now`; a December post seen in January is last year). */
export function dailyDate(title: string, now: Date): string | undefined {
  const m = /(\d{1,2})\/(\d{1,2})/.exec(title);
  if (!m) return undefined;
  const tw = new Date(now.getTime() + 8 * 3_600_000);
  let y = tw.getUTCFullYear();
  if (Number(m[1]) - 1 > tw.getUTCMonth()) y -= 1;
  return `${y}-${m[1]!.padStart(2, '0')}-${m[2]!.padStart(2, '0')}`;
}
