import { describe, expect, it } from 'vitest';
import { onRequest } from '../../functions/_middleware.ts';
import { onRequestGet, onRequestPost } from '../../functions/api/favs.ts';
import { cleanId, cleanWho, MAX_FAVS, setFav } from '../../functions/lib/favs.ts';

const BASE = 'https://dc-dispatch.pages.dev';
const store = () => {
  const m = new Map<string, string>();
  return { m, kv: { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => void m.set(k, v) } };
};
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${BASE}/api/favs`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', origin: BASE, host: 'dc-dispatch.pages.dev', ...headers } });

describe('收藏 (favorites)', () => {
  it('keeps a separate list per reader, newest first, and removes on second tap', async () => {
    const { kv } = store();
    const env = { VIEWS: kv };
    await onRequestPost({ request: post({ who: '我', id: 'lmhaez', on: true }), env });
    await onRequestPost({ request: post({ who: '我', id: '7kdlud', on: true }), env });
    await onRequestPost({ request: post({ who: '老婆', id: 'hsu80a', on: true }), env });
    const mine = await (await onRequestGet({ request: new Request(`${BASE}/api/favs?who=${encodeURIComponent('我')}`), env })).json();
    expect(mine.favs.map((f: { id: string }) => f.id)).toEqual(['7kdlud', 'lmhaez']);
    const hers = await (await onRequestGet({ request: new Request(`${BASE}/api/favs?who=${encodeURIComponent('老婆')}`), env })).json();
    expect(hers.favs.map((f: { id: string }) => f.id)).toEqual(['hsu80a']);
    const after = await (await onRequestPost({ request: post({ who: '我', id: 'lmhaez', on: false }), env })).json();
    expect(after.favs.map((f: { id: string }) => f.id)).toEqual(['7kdlud']);
  });

  it('saving the same story twice keeps one entry, and the list is capped', async () => {
    const { kv } = store();
    for (let n = 0; n < MAX_FAVS + 5; n++) await setFav(kv, '我', `st${n}`, true, new Date());
    const list = await setFav(kv, '我', 'st3', true, new Date());
    expect(list).toHaveLength(MAX_FAVS);
    expect(list[0]!.id).toBe('st3');
    expect(list.filter((f) => f.id === 'st3')).toHaveLength(1);
  });

  it('refuses bad names, bad ids, other sites and broken bodies', async () => {
    const env = { VIEWS: store().kv };
    expect(cleanWho('  我  ')).toBe('我');
    expect(cleanWho('')).toBeNull();
    expect(cleanWho('<script>')).toBeNull();
    expect(cleanWho('a'.repeat(13))).toBeNull();
    expect(cleanId('../x')).toBeNull();
    expect((await onRequestPost({ request: post({ who: '我', id: 'BAD ID', on: true }), env })).status).toBe(400);
    expect((await onRequestPost({ request: post({ who: '我', id: 'lmhaez', on: 'yes' }), env })).status).toBe(400);
    expect((await onRequestPost({ request: post({ who: '我', id: 'lmhaez', on: true }, { origin: 'https://evil.example' }), env })).status).toBe(403);
    expect((await onRequestGet({ request: new Request(`${BASE}/api/favs`), env })).status).toBe(400);
    expect((await onRequestGet({ request: new Request(`${BASE}/api/favs?who=x`), env: {} })).status).toBe(503);
  });

  it('is behind the site lock', async () => {
    const env = { SITE_PASSWORD: 'test-password-123', AUTH_SECRET: 'test-secret-0123456789abcdef' };
    const res = await onRequest({ request: post({ who: '我', id: 'lmhaez', on: true }), env, next: () => Promise.resolve(new Response('API')) });
    expect(res.status).toBe(401);
    const get = await onRequest({ request: new Request(`${BASE}/api/favs?who=x`, { headers: { accept: 'application/json' } }), env, next: () => Promise.resolve(new Response('API')) });
    expect(get.status).toBe(401);
  });
});
