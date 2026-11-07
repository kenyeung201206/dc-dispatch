import raw from '../../data/creator-posts.json' with { type: 'json' };
import { CreatorPostsSchema } from '../schema/item.ts';
import { zhTerms } from './terms.ts';

const parsed = CreatorPostsSchema.safeParse(raw);
if (!parsed.success) throw new Error(`Invalid data/creator-posts.json: ${parsed.error.message}`);

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export const creator = parsed.data.creator;
/** Series and posts still running on the build day; the daily rebuild drops expired ones. */
export const series = parsed.data.series
  .filter((s) => s.until >= today)
  .map((s) => ({
    ...s,
    title_zhHant: zhTerms(s.title_zhHant),
    intro_zhHant: s.intro_zhHant && zhTerms(s.intro_zhHant),
    entries: [...s.entries]
      .sort((a, b) => a.n - b.n)
      .map((e) => ({ ...e, steps_zhHant: e.steps_zhHant.map(zhTerms), result_zhHant: e.result_zhHant && zhTerms(e.result_zhHant) })),
  }));
export const posts = parsed.data.posts
  .filter((p) => p.until >= today)
  .map((p) => ({ ...p, title_zhHant: zhTerms(p.title_zhHant), text_zhHant: zhTerms(p.text_zhHant) }));

/** 1 → total, with the entry if we have it (null = not added yet). */
export const slots = (s: (typeof series)[number]) =>
  Array.from({ length: s.total }, (_, i) => ({ n: i + 1, entry: s.entries.find((e) => e.n === i + 1) ?? null }));
