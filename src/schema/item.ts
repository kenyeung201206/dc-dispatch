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

/** A reusable picture in data/images.json, with a small size for phones. */
export const ImageAssetSchema = MediaSchema.extend({
  id: z.string().min(1),
  kind: z.literal('image'),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  urlSmall: httpsUrl,
  widthSmall: z.number().int().positive(),
  tags: z.array(z.string()).default([]),
});
export type ImageAsset = z.infer<typeof ImageAssetSchema>;

export const ImageLibrarySchema = z.object({
  images: z.array(ImageAssetSchema).min(1),
  /** Banner picture per section (by image id). */
  sectionBanners: z.record(z.string(), z.string()).default({}),
});

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
    /** Picture for this story, by id in data/images.json. */
    imageId: z.string().optional(),
    relatedIds: z.array(z.string()).default([]),
    status: z.enum(['new', 'updated', 'fixed', 'retracted']).default('new'),
    /** Glitch Watch only (brief §4.2). */
    glitch: z
      .object({
        state: z.enum(['active', 'hotfixed', 'patched']),
        firstSeen: z.iso.date(),
        banRisk: z.boolean(),
        riskNote_en: z.string().min(1),
        riskNote_zhHant: Localized,
      })
      .optional(),
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
  /** Masthead context, e.g. "Y8S3 · Red Horizon" / "TU Y8S3.3". */
  meta: z
    .object({
      season_en: z.string().min(1),
      season_zhHant: z.string().min(1),
      titleUpdate: z.string().min(1),
    })
    .optional(),
  /** True when the edition was built from hand-written fixtures, not the pipeline. */
  fixture: z.boolean().default(false),
  items: z.array(ItemSchema).min(1, 'never publish an empty edition'),
  sources: z.array(SourceHealthSchema),
});
export type Edition = z.infer<typeof EditionSchema>;
