/**
 * GET  /api/favs?who=我           → { status: "ok", favs: [{ id, at }] }  (newest first)
 * POST /api/favs {who, id, on}    → same, after adding (on: true) or removing the story
 * Behind the site lock like everything else; POST only from our own pages.
 */
import { cleanId, cleanWho, readFavs, setFav } from '../lib/favs.ts';
import type { ViewsEnv } from '../lib/views.ts';

const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

export async function onRequestGet({ request, env }: { request: Request; env: ViewsEnv }): Promise<Response> {
  if (!env.VIEWS) return reply({ status: 'off' }, 503);
  const who = cleanWho(new URL(request.url).searchParams.get('who'));
  if (!who) return reply({ status: 'bad-request' }, 400);
  return reply({ status: 'ok', favs: await readFavs(env.VIEWS, who) });
}

export async function onRequestPost({ request, env }: { request: Request; env: ViewsEnv }): Promise<Response> {
  if (!env.VIEWS) return reply({ status: 'off' }, 503);
  const origin = request.headers.get('origin');
  if (origin) {
    let host = '';
    try {
      host = new URL(origin).host;
    } catch {}
    if (host !== (request.headers.get('host') ?? new URL(request.url).host)) return reply({ status: 'forbidden' }, 403);
  }
  let body: { who?: unknown; id?: unknown; on?: unknown } = {};
  try {
    body = await request.json();
  } catch {}
  const who = cleanWho(body.who);
  const id = cleanId(body.id);
  if (!who || !id || typeof body.on !== 'boolean') return reply({ status: 'bad-request' }, 400);
  try {
    return reply({ status: 'ok', favs: await setFav(env.VIEWS, who, id, body.on, new Date()) });
  } catch {
    return reply({ status: 'error' }, 503);
  }
}
