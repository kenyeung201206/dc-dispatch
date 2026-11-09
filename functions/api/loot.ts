/**
 * GET /api/loot → today's 戰鬥升級 list, read live from ProtoTrack.gg (behind the site lock like everything else).
 * The box on the front page asks this on load, so the new list shows within a minute of ProtoTrack posting it
 * (~2 min after the 17:00 Tokyo reset), without waiting for a GitHub run. Cloudflare keeps ProtoTrack's file for
 * 60 s, so readers reloading never send ProtoTrack more than about one request a minute.
 */
import { lootDay, parseProtoTrack, PROTOTRACK_PAGE, PROTOTRACK_TXT } from '../../pipeline/sources/prototrack.ts';
import { matchReward } from '../../src/lib/loot.ts';

const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

export async function onRequestGet(): Promise<Response> {
  try {
    const res = await fetch(PROTOTRACK_TXT, {
      headers: { 'user-agent': 'DCDispatchBot/0.1 (private fan newspaper)' },
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
      cf: { cacheTtl: 60, cacheEverything: true },
    } as RequestInit);
    if (!res.ok) return json({ status: 'error' }, 502);
    const loot = parseProtoTrack((await res.text()).slice(0, 20_000));
    // A date after today's loot day would be a typo on their side: don't show it early.
    if (!loot || loot.date > lootDay(new Date())) return json({ status: 'none' });
    return json({
      status: 'ok',
      date: loot.date,
      url: PROTOTRACK_PAGE,
      missions: loot.missions.map((m) => ({ ...m, hit: matchReward(m.reward, m.kind) ?? null })),
      vendor: loot.vendor.map((v) => ({ name: v, hit: matchReward(v, 'other') ?? null })),
    });
  } catch {
    return json({ status: 'error' }, 502);
  }
}
