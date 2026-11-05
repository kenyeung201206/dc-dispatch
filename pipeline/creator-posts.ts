/**
 * 灰帽特工's hand-curated posts (data/creator-posts.json) → newspaper stories in their own section.
 * Only posts from the last few days run as news; all live posts stay on the Guides page until they expire.
 * Always COMMUNITY: he relays and explains, he isn't Ubisoft.
 */
import { CreatorPostsSchema, type CreatorPosts, type Item } from '../src/schema/item.ts';
import { tagsFor } from './classify.ts';
import { score } from './score.ts';
import { stableId } from './text.ts';

export const FRESH_DAYS = 3;
const DAY = 86_400_000;

export function creatorPostStories(raw: unknown, now: Date): Item[] {
  const data: CreatorPosts = CreatorPostsSchema.parse(raw);
  const today = now.toISOString().slice(0, 10);
  const fresh = (d: string) => now.getTime() - Date.parse(`${d}T00:00:00Z`) <= FRESH_DAYS * DAY;
  // Missions the robot added (they carry publishedAt) run as a story too: 「Y8S4 獵捕偵查任務 3」 + its steps.
  const missions: Item[] = data.series.flatMap((s) =>
    s.entries
      .filter((e) => e.publishedAt && e.postUrl && s.until >= today && fresh(e.publishedAt))
      .map((e) => {
        const headline = `${s.title_zhHant} ${e.n}${e.final ? '（完）' : ''}`;
        const headlineEn = `${s.title_en} ${e.n}${e.final ? ' (final)' : ''}`;
        const summary = e.steps_zhHant.map((st, i) => `${i + 1}. ${st}`).join(' ') + (e.result_zhHant ? ` ${e.result_zhHant}` : '');
        const summaryEn = e.steps_en.map((st, i) => `${i + 1}. ${st}`).join(' ') + (e.result_en ? ` ${e.result_en}` : '');
        const item: Item = {
          id: stableId(e.postUrl!),
          sourceId: 'creator-posts',
          sourceName: data.creator.name,
          sourceUrl: e.postUrl!,
          title_orig: headline,
          lang_orig: 'zh',
          publishedAt: `${e.publishedAt}T00:00:00Z`,
          fetchedAt: now.toISOString(),
          category: 'missions',
          tags: [...tagsFor(headlineEn, summaryEn), 'creator'],
          importance: 0,
          confidence: 'community',
          headline_en: headlineEn,
          headline_zhHant: headline,
          summary_en: summaryEn,
          summary_zhHant: summary,
          summaryKind: 'original',
          alsoReportedBy: [],
          media: [],
          relatedIds: [],
          status: 'new',
        };
        item.importance = score(item, 0, now);
        return item;
      }),
  );
  return [...missions, ...data.posts
    .filter((p) => p.until >= today && now.getTime() - Date.parse(`${p.publishedAt}T00:00:00Z`) <= FRESH_DAYS * DAY)
    .map((p) => {
      const url = p.postUrl ?? data.creator.postsUrl;
      const item: Item = {
        id: stableId(url),
        sourceId: 'creator-posts',
        sourceName: data.creator.name,
        sourceUrl: url,
        title_orig: p.title_zhHant,
        lang_orig: 'zh',
        publishedAt: `${p.publishedAt}T00:00:00Z`,
        fetchedAt: now.toISOString(),
        category: p.category,
        tags: [...tagsFor(p.title_en, p.text_en), 'creator'],
        importance: 0,
        confidence: 'community',
        headline_en: p.title_en,
        headline_zhHant: p.title_zhHant,
        summary_en: p.text_en,
        summary_zhHant: p.text_zhHant,
        summaryKind: 'original',
        alsoReportedBy: [],
        media: [],
        relatedIds: [],
        status: 'new',
      };
      item.importance = score(item, 0, now);
      return item;
    })];
}
