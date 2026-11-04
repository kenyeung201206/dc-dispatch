import { z } from 'zod';

/** Newspaper sections (brief §4.2). */
export const CATEGORIES = [
  'front-page',
  'updates',
  'arsenal',
  'missions',
  'glitch-watch',
  'dark-zone',
  'builds',
  'community',
  'watch-now',
  'franchise',
  'back-page',
] as const;
export const CategorySchema = z.enum(CATEGORIES);
export type Category = z.infer<typeof CategorySchema>;

const httpsUrl = z.url({ protocol: /^https$/ });

/** Every image or video must carry licence + attribution (brief §9.3). */
export const MediaSchema = z.object({
  kind: z.enum(['image', 'youtube', 'twitch-clip', 'twitch-live']),
  url: httpsUrl,
  alt_en: z.string().min(1),
  alt_zhHant: z.string().min(1),
  license: z.string().min(1),
  attribution: z.string().min(1),
  attributionUrl: httpsUrl,
  aiGenerated: z.boolean().default(false),
});
export type Media = z.infer<typeof MediaSchema>;

const PENDING = 'pending' as const;
/** A translated field is either text or an explicit "pending" flag. */
const Localized = z.union([z.string().min(1), z.literal(PENDING)]);

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const MAX_SUMMARY_WORDS = 80;

/** Unified item schema (brief §4.1). */
export const ItemSchema = z
  .object({
    id: z.string().min(1),
    sourceId: z.string().min(1),
    sourceName: z.string().min(1),
    sourceUrl: httpsUrl,
    title_orig: z.string().min(1),
    lang_orig: z.string().min(2),
    publishedAt: z.iso.datetime({ offset: true }),
    fetchedAt: z.iso.datetime({ offset: true }),
    category: CategorySchema,
    tags: z.array(z.string()).default([]),
    importance: z.number().int().min(0).max(100),
    confidence: z.enum(['official', 'reported', 'rumour']),
    headline_en: z.string().min(1),
    headline_zhHant: Localized,
    summary_en: z.string().min(1),
    summary_zhHant: Localized,
    whyItMatters_en: z.string().optional(),
    whyItMatters_zhHant: Localized.optional(),
    media: z.array(MediaSchema).default([]),
    relatedIds: z.array(z.string()).default([]),
    status: z.enum(['new', 'updated', 'fixed', 'retracted']).default('new'),
  })
  .refine((i) => wordCount(i.summary_en) <= MAX_SUMMARY_WORDS, {
    message: `summary_en must be ≤ ${MAX_SUMMARY_WORDS} words`,
    path: ['summary_en'],
  });
export type Item = z.infer<typeof ItemSchema>;

export const SourceHealthSchema = z.object({
  sourceId: z.string(),
  ok: z.boolean(),
  checkedAt: z.iso.datetime({ offset: true }),
  note: z.string().optional(),
});

/** One daily edition file: data/editions/YYYY-MM-DD.json */
export const EditionSchema = z.object({
  date: z.iso.date(),
  editionNumber: z.number().int().positive(),
  generatedAt: z.iso.datetime({ offset: true }),
  items: z.array(ItemSchema).min(1, 'never publish an empty edition'),
  sources: z.array(SourceHealthSchema),
});
export type Edition = z.infer<typeof EditionSchema>;
