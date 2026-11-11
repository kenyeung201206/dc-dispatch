/**
 * GET /api/live — Cloudflare Pages Function (public site).
 * Secrets TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET come from the Pages project's environment.
 * The answer is remembered for 5 minutes on the server and in the browser, so many readers
 * still mean only a few Twitch requests (far below Twitch's rate limits).
 */
import { getLive, type LiveResponse, type TwitchEnv } from '../lib/twitch.ts';

interface Ctx {
  env: TwitchEnv;
}

const FRESH_MS = 5 * 60_000;
let memo: { data: LiveResponse; at: number } | undefined;

/** Clear the remembered answer (tests). */
export function _resetLive() {
  memo = undefined;
}

export async function onRequestGet({ env }: Ctx, now = Date.now()): Promise<Response> {
  if (!memo || now - memo.at >= FRESH_MS) {
    const data = await getLive(env);
    memo = data.status === 'error' ? undefined : { data, at: now };
    if (!memo) return reply(data, 'no-store');
  }
  return reply(memo.data, `public, max-age=${Math.max(0, Math.round((FRESH_MS - (now - memo.at)) / 1000))}`);
}

function reply(data: LiveResponse, cache: string): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache, 'x-content-type-options': 'nosniff' },
  });
}
