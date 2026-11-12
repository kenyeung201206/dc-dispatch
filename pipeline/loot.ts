/**
 * Loot-only update for the 16:00 Taiwan/HK time reset (loot.yml): no news, no YouTube, so it costs no API quota.
 * Checks ProtoTrack once (loot.yml runs it at 16:10 and 16:20 Taiwan/HK time; the 2-hourly edition run also checks).
 * With --until-utc HH:MM it keeps checking every 3 minutes until then. The front-page box also reads ProtoTrack
 * live through /api/loot, so readers see the new list even when GitHub starts these runs late.
 * Writes `changed=true|false` to $GITHUB_OUTPUT so the workflow only builds and deploys when needed.
 *   node pipeline/loot.ts [--until-utc 09:55] [--wait-s 180]
 */
import { appendFile, readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { LOOT_FILE, updateDailyLoot } from './daily-loot.ts';
import { log } from './log.ts';
import { lootDay } from './sources/prototrack.ts';

const { values: args } = parseArgs({
  options: { 'until-utc': { type: 'string', default: '00:00' }, 'wait-s': { type: 'string', default: '180' } },
});
const waitMs = Number(args['wait-s']) * 1000;
const deadline = new Date(`${new Date().toISOString().slice(0, 10)}T${args['until-utc']}:00Z`).getTime();

const savedDate = async () => {
  try {
    return (JSON.parse(await readFile(LOOT_FILE, 'utf8')) as { date?: string }).date ?? '';
  } catch {
    return '';
  }
};

let changed = false;
for (let i = 1; ; i++) {
  const now = new Date();
  if ((await updateDailyLoot(now)) !== undefined) changed = true;
  const have = await savedDate();
  if (have >= lootDay(now)) break;
  log('info', 'daily loot not posted yet', { have, want: lootDay(now), attempt: i });
  if (Date.now() + waitMs > deadline) break;
  await sleep(waitMs);
}
if ((await savedDate()) < lootDay(new Date())) log('warn', 'daily loot: still waiting for the new list; the 2-hourly run keeps checking',{ have: await savedDate() });
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
