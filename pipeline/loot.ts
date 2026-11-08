/**
 * Loot-only update for the 17:00 Tokyo reset (loot.yml): no news, no YouTube, so it costs no API quota.
 * Checks ProtoTrack every 3 minutes for up to ~45 minutes until today's list is there.
 * Writes `changed=true|false` to $GITHUB_OUTPUT so the workflow only builds and deploys when needed.
 *   node pipeline/loot.ts [--tries 15] [--wait-s 180]
 */
import { appendFile, readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { LOOT_FILE, updateDailyLoot } from './daily-loot.ts';
import { log } from './log.ts';
import { lootDay } from './sources/prototrack.ts';

const { values: args } = parseArgs({
  options: { tries: { type: 'string', default: '15' }, 'wait-s': { type: 'string', default: '180' } },
});
const tries = Number(args.tries);
const waitMs = Number(args['wait-s']) * 1000;

const savedDate = async () => {
  try {
    return (JSON.parse(await readFile(LOOT_FILE, 'utf8')) as { date?: string }).date ?? '';
  } catch {
    return '';
  }
};

let changed = false;
for (let i = 1; i <= tries; i++) {
  const now = new Date();
  if ((await updateDailyLoot(now)) !== undefined) changed = true;
  const have = await savedDate();
  if (have >= lootDay(now)) break;
  log('info', 'daily loot not posted yet', { have, want: lootDay(now), attempt: i });
  if (i < tries) await sleep(waitMs);
}
if (!changed) log('warn', 'daily loot: no new list this run', { have: await savedDate() });
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
