// Fails when the 今日戰鬥升級 box still shows yesterday's list at 20:00 Taiwan/HK time (4 h after the 17:00 reset):
// neither ProtoTrack nor 巴哈 had the new list by then, or the loot run broke. Run: node scripts/check-loot.ts
import { readFileSync } from 'node:fs';
import { lootDay, lootIsLate } from '../pipeline/sources/prototrack.ts';

const saved = (JSON.parse(readFileSync('data/daily-loot.json', 'utf8')) as { date?: string }).date ?? '';
const now = new Date();
if (lootIsLate(saved, now)) {
  console.error(`戰鬥升級 box is out of date: it shows ${saved || 'nothing'}, today is ${lootDay(now)}. Check the "Daily loot" run, ProtoTrack.gg and 巴哈's daily post.`);
  process.exit(1);
}
console.log(`戰鬥升級 box OK: shows ${saved}, loot day ${lootDay(now)}.`);
