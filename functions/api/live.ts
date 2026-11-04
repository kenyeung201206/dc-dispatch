/**
 * GET /api/live — Cloudflare Pages Function (deployed in Phase 7, behind Cloudflare Access).
 * Secrets TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET come from the Pages project's environment.
 */
import { getLive, type TwitchEnv } from '../lib/twitch.ts';

interface Ctx {
  env: TwitchEnv;
}

export async function onRequestGet({ env }: Ctx): Promise<Response> {
  const data = await getLive(env);
  return new Response(JSON.stringify(data), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Private: the site sits behind Access. 5 minutes keeps us far below Twitch rate limits.
      'cache-control': data.status === 'error' ? 'no-store' : 'private, max-age=300',
      'x-content-type-options': 'nosniff',
    },
  });
}
