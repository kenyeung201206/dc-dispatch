import { z } from 'zod';
import { EditionSchema, type Edition, type Item } from '../src/schema/item.ts';
import { MAX_ITEMS, SEASON, WINDOW_DAYS, type SourceId } from './config.ts';
import type { SourceResult } from './sources/types.ts';

/** Hand-written editor fixes, keyed by item id (data/overrides.json). Applied after the pipeline. */
export const OverridesSchema = z.record(
  z.string(),
  z
    .object({
      headline_en: z.string().min(1),
      headline_zhHant: z.string().min(1),
      summary_en: z.string().min(1),
      summary_zhHant: z.string().min(1),
      summaryKind: z.enum(['original', 'extract']),
      whyItMatters_en: z.string().min(1),
      whyItMatters_zhHant: z.string().min(1),
      riskNote_zhHant: z.string().min(1),
      banRisk: z.boolean(),
      category: z.string(),
      hide: z.boolean(),
    })
    .partial(),
);
export type Overrides = z.infer<typeof OverridesSchema>;

export function applyOverrides(items: Item[], overrides: Overrides): Item[] {
  return items
    .filter((i) => !overrides[i.id]?.hide)
    .map((i) => {
      const o = overrides[i.id];
      if (!o) return i;
      const { riskNote_zhHant, banRisk, hide: _h, category, ...rest } = o;
      const next = { ...i, ...rest } as Item;
      if (category) next.category = category as Item['category'];
      if (next.glitch && (riskNote_zhHant || banRisk !== undefined)) {
        next.glitch = {
          ...next.glitch,
          ...(riskNote_zhHant ? { riskNote_zhHant } : {}),
          ...(banRisk !== undefined ? { banRisk } : {}),
        };
      }
      return next;
    });
}

const DAY = 86_400_000;

/** YouTube API data may be kept 30 days at most: drop video stories from older archived editions. */
export function scrubOldYoutube(edition: Edition, now: Date): Edition | null {
  if (now.getTime() - Date.parse(`${edition.date}T00:00:00+09:00`) <= 30 * DAY) return null;
  const items = edition.items.filter((i) => i.sourceId !== 'youtube');
  if (items.length === edition.items.length || !items.length) return null;
  return { ...edition, items };
}
const GLITCH_KEEP_DAYS = 60;

export interface AssembleInput {
  date: string;
  now: Date;
  fresh: Item[];
  results: SourceResult[];
  previous?: Edition;
  overrides: Overrides;
}

/**
 * Build today's edition: keep yesterday's items for any source that failed,
 * keep still-active glitches, mark updated stories, trim to the time window.
 * Throws rather than return an empty edition.
 */
export function assembleEdition({ date, now, fresh, results, previous, overrides }: AssembleInput): Edition {
  const prev = previous && !previous.fixture ? previous : undefined;
  const prevById = new Map(prev?.items.map((i) => [i.id, i]) ?? []);
  const failed = new Set<SourceId>(results.filter((r) => !r.ok).map((r) => r.sourceId));

  const byId = new Map<string, Item>();
  for (const item of fresh) {
    const old = prevById.get(item.id);
    const status = old ? (old.headline_en !== item.headline_en ? 'updated' : old.status) : 'new';
    byId.set(item.id, { ...item, status });
  }
  for (const old of prev?.items ?? []) {
    if (byId.has(old.id)) continue;
    const fromFailedSource = failed.has(old.sourceId as SourceId);
    const stillActiveGlitch =
      old.glitch?.state === 'active' && now.getTime() - Date.parse(old.glitch.firstSeen) < GLITCH_KEEP_DAYS * DAY;
    if (fromFailedSource || stillActiveGlitch) byId.set(old.id, old);
  }

  const cutoff = now.getTime() - WINDOW_DAYS * DAY;
  const items = applyOverrides([...byId.values()], overrides)
    .filter((i) => Date.parse(i.publishedAt) >= cutoff || i.glitch?.state === 'active')
    .sort((a, b) => b.importance - a.importance)
    .slice(0, MAX_ITEMS);
  if (!items.length) throw new Error('Refusing to publish an empty edition');

  const tu = items
    .map((i) => i.title_orig.match(/TU ?(Y\d+S\d+(?:\.\d+)?)/i)?.[1])
    .find(Boolean);
  return EditionSchema.parse({
    date,
    editionNumber: prev ? prev.editionNumber + 1 : 1,
    generatedAt: now.toISOString(),
    fixture: false,
    meta: { ...SEASON, ...(tu ? { titleUpdate: `TU ${tu.toUpperCase()}` } : {}) },
    items,
    sources: results.map((r) => ({ sourceId: r.sourceId, ok: r.ok, checkedAt: now.toISOString(), note: r.note })),
  });
}
