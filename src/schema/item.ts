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
    /** official = publisher; reported = press; community = forums/creators; rumour = leaks, datamines, unconfirmed. */
    confidence: z.enum(['official', 'reported', 'community', 'rumour']),
    /** English may be "pending" for stories that start in Chinese (e.g. 巴哈姆特) until translated. */
    headline_en: Localized,
    headline_zhHant: Localized,
    summary_en: Localized,
    summary_zhHant: Localized,
    /** "extract" = short quote from the source (≤ 25 words), shown in quotation marks. */
    summaryKind: z.enum(['original', 'extract', 'ai']).default('original'),
    /** How the Chinese summary should be shown, when it differs (e.g. our own write-up of an English quote). */
    summaryKind_zhHant: z.enum(['original', 'extract', 'ai']).optional(),
    /** Other outlets carrying the same story ("Reported by N sources"). */
    alsoReportedBy: z.array(z.object({ name: z.string().min(1), url: httpsUrl })).default([]),
    whyItMatters_en: z.string().optional(),
    whyItMatters_zhHant: Localized.optional(),
    media: z.array(MediaSchema).default([]),
    /** Picture for this story, by id in data/images.json. */
    imageId: z.string().optional(),
    /** YouTube video this story is about (creator scan). */
    videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/).optional(),
    relatedIds: z.array(z.string()).default([]),
    /** When the robot first published this story (drives the 新 badge and the 最新更新 box). */
    firstSeenAt: z.iso.datetime({ offset: true }).optional(),
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

/** One title update in the Patch Notes Tracker (data/patches.json). Facts read from the notes. */
export const PatchSchema = z.object({
  version: z.string().regex(/^Y\d+S\d+(\.\d+)?$/),
  title: z.string().min(1),
  url: httpsUrl,
  publishedAt: z.iso.datetime({ offset: true }),
  /** Top-level headings of the notes, e.g. "Crossplay", "Master Climax Mission". */
  sections: z.array(z.string()),
  fixes: z.number().int().min(0),
  knownIssues: z.number().int().min(0),
  /** "X from A to B" lines: up = number went up, down = went down. Short quotes (≤ 25 words). */
  changes: z.array(z.object({ text: z.string().min(1), direction: z.enum(['up', 'down']) })),
  itemId: z.string().optional(),
});
export type Patch = z.infer<typeof PatchSchema>;
export const PatchLogSchema = z.object({ patches: z.array(PatchSchema) });

/** Exotic intel (data/exotics.json): official tables/mentions + exotics newly added to the community wiki. */
export const ExoticSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
  talent: z.string().optional(),
  /** Short quote (≤ 25 words) from the source describing it. */
  text: z.string().optional(),
  /** released = in a live title update; pts = on the test server; announced = officially named; spotted = added to the wiki. */
  status: z.enum(['released', 'pts', 'announced', 'spotted']),
  confidence: z.enum(['official', 'community']),
  firstSeen: z.iso.datetime({ offset: true }),
  sources: z.array(z.object({ name: z.string().min(1), url: httpsUrl })).min(1),
});
export type Exotic = z.infer<typeof ExoticSchema>;
export const ExoticLogSchema = z.object({ exotics: z.array(ExoticSchema) });

/** Limited-time events (data/events.json): guides tied to an event disappear after it ends. */
export const GameEventSchema = z.object({
  id: z.string().min(1),
  name_en: z.string().min(1),
  name_zhHant: z.string().min(1),
  start: z.iso.date(),
  end: z.iso.date(),
  match: z.array(z.string().min(1)).min(1),
  source: httpsUrl,
  auto: z.boolean().optional(),
});
export type GameEvent = z.infer<typeof GameEventSchema>;
export const GameEventLogSchema = z.object({ _note: z.string().optional(), events: z.array(GameEventSchema) });

/**
 * 攻略精選 / Guide Picks (data/guides.json): creator guides shown until their event ends (or 60 days).
 * Videos play through the official embed; posts are linked with a short summary in our own words.
 */
export const GuideSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['video', 'post']),
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/).optional(),
  url: httpsUrl,
  title: z.string().min(1),
  channelName: z.string().min(1),
  channelUrl: httpsUrl,
  publishedAt: z.iso.datetime({ offset: true }),
  /** Our own short summary (never copied text). */
  summary_zhHant: z.string().optional(),
  summary_en: z.string().optional(),
  eventId: z.string().optional(),
  /** Last day to show (Asia/Tokyo calendar date). */
  until: z.iso.date(),
  addedBy: z.enum(['auto', 'editor']),
  /** When a video was last confirmed embeddable (YouTube data: refresh within 30 days). */
  checkedAt: z.iso.datetime({ offset: true }).optional(),
});
export type Guide = z.infer<typeof GuideSchema>;
export const GuideLogSchema = z.object({ guides: z.array(GuideSchema) });

/** Creator mission guides written from posts the owner pasted (data/creator-posts.json). */
const SeriesEntrySchema = z.object({
  n: z.number().int().positive(),
  final: z.boolean().optional(),
  steps_zhHant: z.array(z.string().min(1)).min(1),
  steps_en: z.array(z.string().min(1)).min(1),
  result_zhHant: z.string().optional(),
  result_en: z.string().optional(),
  /** Direct link to the post, if the owner sent it; otherwise the posts tab is linked. */
  postUrl: httpsUrl.optional(),
  seen: z.iso.date(),
  /** Day he posted it; set when the robot added it (those also run as a news story while fresh). */
  publishedAt: z.iso.date().optional(),
});
export const CreatorPostsSchema = z.object({
  _note: z.string().optional(),
  /** YouTube post ids already handled (added or deliberately skipped), so the robot never re-adds them. */
  knownPostIds: z.array(z.string().min(1)).optional(),
  creator: z.object({ name: z.string().min(1), channelUrl: httpsUrl, postsUrl: httpsUrl }),
  series: z.array(
    z.object({
      id: z.string().min(1),
      title_zhHant: z.string().min(1),
      title_en: z.string().min(1),
      intro_zhHant: z.string().optional(),
      intro_en: z.string().optional(),
      total: z.number().int().positive(),
      until: z.iso.date(),
      untilNote: z.string().optional(),
      entries: z.array(SeriesEntrySchema),
    }),
  ),
  posts: z.array(
    z.object({
      id: z.string().min(1),
      title_zhHant: z.string().min(1),
      title_en: z.string().min(1),
      text_zhHant: z.string().min(1),
      text_en: z.string().min(1),
      /** Which newspaper section it belongs to. */
      category: CategorySchema,
      /** Day he posted it (approximate when YouTube only showed "2 weeks ago"). Recent ones also run as a story. */
      publishedAt: z.iso.date(),
      /** Redeem codes, shown as copyable chips. */
      codes: z.array(z.object({ label: z.string().optional(), label_zhHant: z.string().optional(), code: z.string().regex(/^[A-Z0-9-]{6,32}$/) })).optional(),
      /** Extra link from the post (e.g. Ubisoft patch notes or a sign-up page). */
      link: httpsUrl.optional(),
      postUrl: httpsUrl.optional(),
      seen: z.iso.date(),
      until: z.iso.date(),
      /** Added by the robot from his posts page (his own words; no hand-written English yet). */
      auto: z.boolean().optional(),
    }),
  ),
});
export type CreatorPosts = z.infer<typeof CreatorPostsSchema>;

/** Watch Now rows (brief §8). */
export const VIDEO_ROWS = ['intel', 'trailers', 'patch-breakdowns', 'build-guides', 'more'] as const;

/** A YouTube video confirmed embeddable + public on the date in checkedAt (data/videos.json). */
export const VideoSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  /** Regional upload of the same video for Chinese readers, if Ubisoft has one. */
  idZh: z.string().regex(/^[A-Za-z0-9_-]{11}$/).optional(),
  title: z.string().min(1),
  titleZh: z.string().min(1).optional(),
  channelName: z.string().min(1),
  channelUrl: httpsUrl,
  publishedAt: z.iso.datetime({ offset: true }),
  durationSec: z.number().int().positive().optional(),
  official: z.boolean(),
  row: z.enum(VIDEO_ROWS),
  /** When we last confirmed it is public and embeddable (YouTube data must be refreshed within 30 days). */
  checkedAt: z.iso.datetime({ offset: true }),
  via: z.enum(['ubisoft-page', 'youtube-api', 'youtube-search']),
  /** Title sounds like a leak/datamine/unreleased content: shown with a RUMOUR stamp. */
  rumour: z.boolean().default(false),
});
export type Video = z.infer<typeof VideoSchema>;
export const VideoLibrarySchema = z.object({ videos: z.array(VideoSchema) });

/** Health of the last pipeline run, for the Status page (data/status.json). No secrets, only booleans. */
export const RunStatusSchema = z.object({
  lastRun: z.iso.datetime({ offset: true }),
  durationMs: z.number().int().min(0),
  edition: z.object({ date: z.iso.date(), number: z.number().int().positive(), items: z.number().int(), zhPending: z.number().int() }),
  sources: z.array(z.object({ id: z.string(), ok: z.boolean(), items: z.number().int(), note: z.string().optional(), failingSince: z.iso.datetime({ offset: true }).optional() })),
  videos: z.object({ total: z.number().int(), youtubeApiConfigured: z.boolean() }),
  budget: z.object({ youtubeQuotaUnits: z.number().int(), costUsd: z.number() }),
});
export type RunStatus = z.infer<typeof RunStatusSchema>;

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

/** Editor translations for English-only content (data/translations.zh.json). Chinese pages use these. */
export const TranslationsZhSchema = z.object({
  _note: z.string().optional(),
  items: z.record(
    z.string(),
    z.object({
      headline: z.string().min(1),
      summary: z.string().min(1),
      whyItMatters: z.string().min(1).optional(),
      riskNote: z.string().min(1).optional(),
      /** "original" when the Chinese is our own write-up rather than a translated quote. */
      summaryKind: z.enum(['original', 'extract']).optional(),
    }),
  ),
  /** YouTube video id → Chinese title. */
  videos: z.record(z.string(), z.string().min(1)),
  /** Exotic English name → Chinese fields. Names are our own unless Ubisoft Taiwan has one. */
  exotics: z.record(z.string(), z.object({ name: z.string().min(1), talent: z.string().optional(), text: z.string().optional() })),
  /** Patch version → Chinese title, section headings and change lines (same order as data/patches.json). */
  patches: z.record(z.string(), z.object({ title: z.string().min(1), sections: z.array(z.string()), changes: z.array(z.string()) })),
  /** Source / outlet display names. */
  sources: z.record(z.string(), z.string().min(1)),
});
export type TranslationsZh = z.infer<typeof TranslationsZhSchema>;

/** 重點整理 (data/briefs.zh.json): our own Chinese write-up of a story's source, keyed by story id. Never the source's text. */
export const BriefsZhSchema = z.object({
  _note: z.string().optional(),
  items: z.record(
    z.string(),
    z.object({
      points: z.array(z.string().min(1)).min(1),
      /** Full data from the source (schedules, rewards, numbers) kept complete, in our own table. */
      tables: z
        .array(z.object({ title: z.string().min(1), columns: z.array(z.string().min(1)).min(2), rows: z.array(z.array(z.string())).min(1) }))
        .optional(),
      body: z.array(z.string().min(1)).optional(),
      written: z.iso.date(),
    }),
  ),
});
export type BriefsZh = z.infer<typeof BriefsZhSchema>;
