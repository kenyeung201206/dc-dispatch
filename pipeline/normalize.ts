import type { Item } from '../src/schema/item.ts';
import { classify, tagsFor } from './classify.ts';
import { canonicalUrl, type Story } from './dedupe.ts';
import { ensureUbisoftImage, type ImageLibrary } from './media/images.ts';
import { score } from './score.ts';
import type { RawItem } from './sources/types.ts';
import { parseKnownIssues, summarize } from './summarize.ts';
import { extractWords, stableId } from './text.ts';

export interface BuildContext {
  now: Date;
  /** Official zh-TW copies of Ubisoft articles, by Ubisoft content id. */
  zhById: Map<string, RawItem>;
  images: ImageLibrary;
}

/** Turn one deduplicated story into an edition item (plus Glitch Watch items for its known issues). */
export function storyToItems(story: Story, ctx: BuildContext): Item[] {
  const { primary, others } = story;
  const zh = [primary, ...others].map((r) => ctx.zhById.get(r.externalId)).find(Boolean);
  const s = summarize(primary, zh);
  const category = classify(primary.title, primary.text, primary.tag);
  const url = canonicalUrl(primary.url);
  const fetchedAt = ctx.now.toISOString();

  const withImage = [primary, ...others].find((r) => r.imageUrl);
  const imageId = withImage
    ? ensureUbisoftImage(ctx.images, withImage.imageUrl!, {
        articleId: withImage.externalId,
        title_en: primary.title,
        title_zh: s.headline_zhHant === 'pending' ? undefined : s.headline_zhHant,
        articleUrl: withImage.url,
      })
    : undefined;

  const base = {
    sourceId: primary.sourceId,
    sourceName: primary.sourceName,
    sourceUrl: url,
    title_orig: primary.title,
    lang_orig: primary.lang,
    publishedAt: primary.publishedAt,
    fetchedAt,
    confidence: primary.confidence,
    media: [],
    relatedIds: [],
    status: 'new' as const,
  };
  const alsoReportedBy = others
    .filter((o) => canonicalUrl(o.url) !== url)
    .map((o) => ({ name: o.sourceName, url: canonicalUrl(o.url) }));

  const main: Item = {
    ...base,
    id: stableId(url),
    category,
    tags: tagsFor(primary.title, primary.text),
    importance: 0,
    ...s,
    alsoReportedBy,
    imageId,
  };
  main.importance = score(main, alsoReportedBy.length, ctx.now);

  const glitches: Item[] = parseKnownIssues(primary.rawBody).map((k, n) => {
    const tu = primary.title.match(/TU ?(Y\d+S\d+(?:\.\d+)?)/i)?.[1];
    const headline = `Known issue${tu ? ` (TU ${tu.toUpperCase()})` : ''}: ${extractWords(k.issue.replace(/\.$/, ''), 12)}`;
    const item: Item = {
      ...base,
      id: stableId(url, 'known-issue', k.issue),
      category: 'glitch-watch',
      tags: ['known-issue'],
      importance: 0,
      headline_en: headline,
      headline_zhHant: 'pending',
      summary_en: extractWords(k.issue, 25),
      summary_zhHant: 'pending',
      summaryKind: 'extract',
      alsoReportedBy: [],
      relatedIds: [main.id],
      glitch: {
        state: 'active',
        firstSeen: primary.publishedAt.slice(0, 10),
        banRisk: false,
        riskNote_en: k.workaround
          ? `Known issue listed by Ubisoft. Workaround: ${extractWords(k.workaround, 20)}`
          : 'Known issue listed by Ubisoft. No workaround yet.',
        riskNote_zhHant: 'pending',
      },
    };
    item.importance = Math.max(0, score(item, 0, ctx.now) - 10 - n);
    return item;
  });
  if (glitches.length) main.relatedIds = glitches.map((g) => g.id);
  return [main, ...glitches];
}
