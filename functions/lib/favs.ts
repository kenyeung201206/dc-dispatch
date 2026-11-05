/**
 * 收藏 (favorites), one list per reader name ("我", "老婆", …), in the same KV namespace as the visit counter.
 * Only signed-in readers reach this (the site lock covers /api/*). Stores story ids + when they were saved,
 * nothing else.
 */
import type { KV } from './views.ts';

export const MAX_FAVS = 500;
export interface Fav {
  id: string;
  at: string;
}

/** Reader name: 1–12 letters/digits (any script), spaces, _ or -. */
export function cleanWho(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const who = raw.normalize('NFC').trim();
  return /^[\p{L}\p{N} _-]{1,12}$/u.test(who) ? who : null;
}
/** Story ids are short lowercase hashes. */
export const cleanId = (raw: unknown): string | null => (typeof raw === 'string' && /^[a-z0-9]{3,16}$/.test(raw) ? raw : null);

const key = (who: string) => `fav:${who}`;

export async function readFavs(kv: KV, who: string): Promise<Fav[]> {
  try {
    const list = JSON.parse((await kv.get(key(who))) ?? '[]');
    return Array.isArray(list) ? list.filter((f) => cleanId(f?.id) && typeof f?.at === 'string') : [];
  } catch {
    return [];
  }
}

/** Adds (newest first) or removes one story; returns the new list. */
export async function setFav(kv: KV, who: string, id: string, on: boolean, now: Date): Promise<Fav[]> {
  const rest = (await readFavs(kv, who)).filter((f) => f.id !== id);
  const list = on ? [{ id, at: now.toISOString() }, ...rest].slice(0, MAX_FAVS) : rest;
  await kv.put(key(who), JSON.stringify(list));
  return list;
}
