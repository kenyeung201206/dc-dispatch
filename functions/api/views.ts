/** GET /api/views → { total, today } page views (public; read-only). */
import { readViews, type ViewsEnv } from '../lib/views.ts';

export async function onRequestGet({ env }: { env: ViewsEnv }): Promise<Response> {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  if (!env.VIEWS) return new Response(JSON.stringify({ status: 'off' }), { status: 503, headers });
  try {
    const v = await readViews(env.VIEWS, Date.now());
    return new Response(JSON.stringify({ status: 'ok', ...v }), { headers });
  } catch {
    return new Response(JSON.stringify({ status: 'error' }), { status: 503, headers });
  }
}
