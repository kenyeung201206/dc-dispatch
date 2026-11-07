/**
 * Chinese-only rule: Chinese pages never print English sentences.
 * Editor translations (data/translations.zh.json) fill English-only content; anything still without
 * Chinese is hidden on Chinese pages. Plain module (no Astro imports) so the pipeline can use it too.
 */
import raw from '../../data/translations.zh.json' with { type: 'json' };
import { TranslationsZhSchema, type Exotic, type Item, type Patch } from '../schema/item.ts';
import { zhTerms } from './terms.ts';

const parsed = TranslationsZhSchema.safeParse(raw);
if (!parsed.success) throw new Error(`Invalid data/translations.zh.json: ${parsed.error.message}`);
export const zh = parsed.data;

const CJK = /[㐀-鿿]/;
export const hasChinese = (s?: string) => Boolean(s && CJK.test(s));
const pending = (v?: string) => !v || v === 'pending';

/** Fill an item's missing Chinese fields from the editor translations (returns a new object). */
export function withZh<T extends Item>(item: T): T {
  const tr = zh.items[item.id];
  if (!tr) return item;
  const out = { ...item };
  if (pending(out.headline_zhHant)) out.headline_zhHant = tr.headline;
  if (pending(out.summary_zhHant)) {
    out.summary_zhHant = tr.summary;
    if (tr.summaryKind) out.summaryKind_zhHant = tr.summaryKind;
  }
  if (tr.whyItMatters && pending(out.whyItMatters_zhHant)) out.whyItMatters_zhHant = tr.whyItMatters;
  if (tr.riskNote && out.glitch && pending(out.glitch.riskNote_zhHant)) out.glitch = { ...out.glitch, riskNote_zhHant: tr.riskNote };
  return out;
}

/** True when a Chinese reader can see this story without any English. */
export const hasZh = (item: Item) => !pending(item.headline_zhHant) && !pending(item.summary_zhHant);

/** Video title for Chinese readers, or undefined when there is none yet. */
export function videoTitleZh(v: { id: string; title: string; titleZh?: string }): string | undefined {
  if (v.titleZh) return v.titleZh;
  if (hasChinese(v.title)) return v.title;
  return zh.videos[v.id];
}

export function exoticZh(e: Exotic): { name?: string; talent?: string; text?: string } {
  const x = zh.exotics[e.name] ?? {};
  return { ...x, talent: x.talent && zhTerms(x.talent), text: x.text && zhTerms(x.text) };
}

export function patchZh(p: Patch): { title?: string; sections?: string[]; changes?: string[] } {
  const tr = zh.patches[p.version];
  if (!tr) return {};
  return {
    title: tr.title,
    sections: tr.sections.length === p.sections.length ? tr.sections.map(zhTerms) : undefined,
    changes: tr.changes.length === p.changes.length ? tr.changes.map(zhTerms) : undefined,
  };
}

/** Outlet name for Chinese readers (people/channel names stay as they are). */
export const sourceZh = (name: string) => zh.sources[name] ?? name;
