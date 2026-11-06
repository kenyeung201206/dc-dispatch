import { EditionSchema, type Edition, type Item } from '../schema/item.ts';
import type { Locale } from '../i18n/index.ts';
import { getImage } from './images.ts';
import { hasZh, withZh } from './zh.ts';

const files = import.meta.glob<{ default: unknown }>('../../data/editions/*.json', { eager: true });

/** All editions, validated at build time, newest first. A bad file fails the build. */
export const editions: Edition[] = Object.entries(files)
  .map(([path, mod]) => {
    const parsed = EditionSchema.safeParse(mod.default);
    if (!parsed.success) throw new Error(`Invalid edition ${path}: ${parsed.error.message}`);
    for (const item of parsed.data.items) if (item.imageId) getImage(item.imageId); // fails on a bad id
    // Editor translations fill English-only stories for Chinese readers.
    return { ...parsed.data, items: parsed.data.items.map(withZh) };
  })
  .sort((a, b) => b.date.localeCompare(a.date));

// First time each story was published: saved firstSeenAt, else its own publish time (capped by the oldest edition
// carrying it). Not the edition's generatedAt alone: today's file is rewritten on every 3-hourly run.
{
  const first = new Map<string, string>();
  for (const e of [...editions].reverse()) {
    if (e.fixture) continue;
    for (const i of e.items) {
      const t = i.firstSeenAt ?? (i.publishedAt < e.generatedAt ? i.publishedAt : e.generatedAt);
      const was = first.get(i.id);
      if (!was || t < was) first.set(i.id, t);
    }
  }
  for (const e of editions) for (const i of e.items) if (first.has(i.id)) i.firstSeenAt = first.get(i.id);
}

export function latestEdition(): Edition {
  const e = editions[0];
  if (!e) throw new Error('No editions found in data/editions/');
  return e;
}

export const byImportance = (a: Item, b: Item) => b.importance - a.importance;
export const byNewest = (a: Item, b: Item) => b.publishedAt.localeCompare(a.publishedAt);

export interface ArchivedItem extends Item {
  /** Most recent edition the story appeared in. */
  editionDate: string;
}

/** Every story across all editions, latest version of each (editions are newest first). */
export const allItems: ArchivedItem[] = (() => {
  const seen = new Map<string, ArchivedItem>();
  for (const e of editions) for (const i of e.items) if (!seen.has(i.id)) seen.set(i.id, { ...i, editionDate: e.date });
  return [...seen.values()].sort(byNewest);
})();

/** Chinese pages show only stories that have Chinese (never an English fallback). */
export const readableIn = (item: Item, locale: Locale) => locale === 'en' || hasZh(item);

export function findItem(id: string): ArchivedItem | undefined {
  return allItems.find((i) => i.id === id);
}

/** Linked stories first, then same-category stories with shared tags. */
export function relatedItems(item: Item, locale: Locale, max = 4): ArchivedItem[] {
  const linked = item.relatedIds.map(findItem).filter((i): i is ArchivedItem => !!i && readableIn(i, locale));
  const similar = allItems.filter(
    (o) => o.id !== item.id && !item.relatedIds.includes(o.id) && o.category === item.category && readableIn(o, locale),
  );
  return [...linked, ...similar].slice(0, max);
}

type LocalizedField = 'headline' | 'summary' | 'whyItMatters';

/** Returns the field in the reader's language; Chinese falls back to English + a pending flag. */
/**
 * The field in the reader's language; if that's still "pending", the other language
 * with pending=true and its lang tag (so screen readers and fonts switch correctly).
 */
export function localized(item: Item, field: LocalizedField, locale: Locale): { text: string; pending: boolean; lang: string } {
  const tidy = (v: string) => (field === 'headline' ? stripHashtags(v) : v);
  const ok = (v?: string) => (v && v !== 'pending' ? tidy(v) : undefined);
  const en = ok(item[`${field}_en`]);
  const zh = ok(item[`${field}_zhHant`]);
  if (locale === 'en') return en ? { text: en, pending: false, lang: 'en' } : { text: zh ?? '', pending: Boolean(zh), lang: 'zh-Hant-TW' };
  return zh ? { text: zh, pending: false, lang: 'zh-Hant-TW' } : { text: en ?? '', pending: Boolean(en), lang: 'en' };
}

/** Video titles often end in hashtag lists (#全境封鎖 #thedivision2 …): drop them from headlines. */
export function stripHashtags(s: string): string {
  // A tag, or a chain of tags with no space between them ("#全境封鎖3#中央公園").
  const out = s.replace(/(^|\s)(#[^\s#]+)+/gu, ' ').replace(/\s{2,}/g, ' ').trim();
  return out || s;
}

/** D.C. weather gag, deterministic by date. */
const WEATHER = {
  en: ['Overcast, chance of Rogues', 'Light drizzle, heavy gunfire', '14°C, 80% chance of loot', 'Foggy; Hunters reported nearby', 'Clear skies, unclear motives'],
  'zh-hant': ['陰天，偶有叛變特工', '毛毛雨，槍聲大作', '攝氏 14 度，掉寶機率 80%', '有霧，附近疑有獵人出沒', '天氣晴朗，動機不明'],
} as const;

export function weatherFor(date: string, locale: Locale): string {
  const list = WEATHER[locale];
  const n = [...date].reduce((s, c) => s + c.charCodeAt(0), 0);
  return list[n % list.length]!;
}
