/**
 * Daily refresh: fetch → normalise → dedupe → classify → summarise → score → write edition.
 *
 *   pnpm run refresh              real run, writes data/editions/<today>.json
 *   pnpm run refresh --dry-run    uses recorded fixtures, no network, writes to .dry-run/
 *   pnpm run refresh --date 2026-11-04
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { BriefsZhSchema, CreatorPostsSchema, EditionSchema, ImageLibrarySchema, ExoticLogSchema, GameEventLogSchema, GuideLogSchema, PatchLogSchema, RunStatusSchema, VideoLibrarySchema, type Edition, type Item } from '../src/schema/item.ts';
import { parsePatch, upsertPatches } from './patches.ts';
import { buildVideos } from './video/build.ts';
import { searchVideos } from './video/youtube.ts';
import { videoStories } from './video/intel-items.ts';
import { creatorPostStories } from './creator-posts.ts';
import { mergeFeed, parsePostsPage } from './creator-feed.ts';
import { exoticsFromArticle, mergeExotics, wikiExotics } from './exotics.ts';
import { eventsFromArticle, guidesFromPicks, guidesFromVideos, liveGuides, mergeEvents, mergeGuides, type Pick } from './guides.ts';
import { checkEmbeddable, fetchChannelVideos } from './video/youtube.ts';
import { SOURCES, TIMEZONE, type SourceId } from './config.ts';
import { dedupe } from './dedupe.ts';
import { assembleEdition, OverridesSchema, scrubOldYoutube } from './edition.ts';
import { politeGet } from './http.ts';
import { log } from './log.ts';
import { stableId } from './text.ts';
import { storyToItems } from './normalize.ts';
import { parseSteamNews } from './sources/steam.ts';
import type { RawItem, SourceResult } from './sources/types.ts';
import { parseUbisoftNews } from './sources/ubisoft.ts';
import { parseBahamutBoard, parseBahamutFirstPost } from './sources/bahamut.ts';
import { updateDailyLoot } from './daily-loot.ts';
import { aiSummaries, needsAi } from './ai.ts';
import { aiBriefs } from './ai-briefs.ts';

const { values: args } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    date: { type: 'string' },
  },
});
const dryRun = args['dry-run'];

const FIXTURES: Record<SourceId, string> = {
  bahamut: 'tests/fixtures/sources/bahamut.html',
  'steam-news': 'tests/fixtures/sources/steam-news.json',
  'ubisoft-en': 'tests/fixtures/sources/ubisoft-en.html',
  'ubisoft-zh-tw': 'tests/fixtures/sources/ubisoft-zh-tw.html',
};
const PARSERS: Record<SourceId, (body: string, now: Date) => RawItem[]> = {
  bahamut: (b, now) => parseBahamutBoard(b, now),
  'steam-news': parseSteamNews,
  'ubisoft-en': (b) => parseUbisoftNews(b, 'ubisoft-en'),
  'ubisoft-zh-tw': (b) => parseUbisoftNews(b, 'ubisoft-zh-tw'),
};

async function runSource(id: SourceId, now: Date): Promise<SourceResult> {
  try {
    const body = dryRun ? await readFile(FIXTURES[id], 'utf8') : await politeGet(SOURCES[id].url);
    const items = PARSERS[id](body, now);
    log('info', 'source ok', { source: id, items: items.length });
    if (!items.length) return { sourceId: id, ok: false, items, note: 'no items parsed (layout change?)' };
    return { sourceId: id, ok: true, items, body };
  } catch (err) {
    log('error', 'source failed', { source: id, error: String(err) });
    return { sourceId: id, ok: false, items: [], note: String(err).slice(0, 200) };
  }
}

const tokyoDate = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

async function previousEdition(date: string): Promise<Edition | undefined> {
  const files = (await readdir('data/editions').catch(() => [] as string[]))
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.slice(0, 10) < date)
    .sort();
  const last = files.at(-1);
  if (!last) return undefined;
  return EditionSchema.parse(JSON.parse(await readFile(join('data/editions', last), 'utf8')));
}

/** Story id → when it was first published, across every saved edition (older files: their generatedAt). */
async function firstSeenIndex(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const files = (await readdir('data/editions').catch(() => [] as string[])).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));
  for (const f of files) {
    let e: Edition;
    try {
      e = EditionSchema.parse(JSON.parse(await readFile(join('data/editions', f), 'utf8')));
    } catch {
      continue;
    }
    if (e.fixture) continue;
    for (const i of e.items) {
      // Older files have no firstSeenAt: use the publish time (today's file is rewritten on every run).
      const t = i.firstSeenAt ?? (i.publishedAt < e.generatedAt ? i.publishedAt : e.generatedAt);
      const was = out.get(i.id);
      if (!was || t < was) out.set(i.id, t);
    }
  }
  return out;
}

async function main() {
  const startedAt = Date.now();
  // Dry runs are pinned to the fixtures' date so results are reproducible.
  const now = args.date
    ? new Date(`${args.date}T06:00:00+09:00`)
    : dryRun
      ? new Date('2026-11-04T06:00:00+09:00')
      : new Date();
  const date = tokyoDate(now);
  log('info', 'refresh start', { date, dryRun });

  const results = await Promise.all((Object.keys(SOURCES) as SourceId[]).map((id) => runSource(id, now)));
  // Today's 戰鬥升級 loot: ProtoTrack.gg first, 巴哈's pinned daily thread as backup (see daily-loot.ts).
  if (!dryRun) {
    const daily = results.find((r) => r.sourceId === 'bahamut')?.items.find((i) => /每日戰鬥升級/.test(i.title));
    await updateDailyLoot(now, daily);
  }
  const zhById = new Map(results.find((r) => r.sourceId === 'ubisoft-zh-tw')!.items.map((i) => [i.externalId, i]));
  const english = results.filter((r) => r.sourceId !== 'ubisoft-zh-tw').flatMap((r) => r.items);

  const images = ImageLibrarySchema.parse(await readJson('data/images.json', {}));
  const stories = dedupe(english);
  // Source text per story, kept in memory for the optional AI step.
  const sourceText = new Map<string, string>();
  const fresh: Item[] = stories.flatMap((s) => {
    const items = storyToItems(s, { now, zhById, images });
    if (items[0]) sourceText.set(items[0].id, [s.primary.abstract, s.primary.text].filter(Boolean).join(' \n'));
    return items;
  });
  log('info', 'processed', { raw: english.length, stories: stories.length, items: fresh.length });

  // Patch Notes Tracker: every title update seen on Ubisoft's page, kept across editions.
  const patchLog = PatchLogSchema.parse(await readJson('data/patches.json', { patches: [] }));
  const foundPatches = stories
    .filter((s) => s.primary.sourceId === 'ubisoft-en')
    .map((s) => parsePatch(s.primary, fresh.find((i) => i.title_orig === s.primary.title)?.id))
    .filter((p) => p !== null);
  const patches = { patches: upsertPatches(patchLog.patches, foundPatches) };

  const videoConfig = await readJson<{
    channels: { id: string; name: string; official: boolean }[];
    searches?: { q: string; lang?: string }[];
    guideCreators?: { id: string; name: string; official: boolean }[];
    follow?: { id: string; name: string; official: boolean }[];
  }>('data/video-channels.json', { channels: [] });
  const channels = videoConfig.channels;
  const youtubeKey = dryRun ? undefined : process.env.YOUTUBE_API_KEY;
  // Watch Now: official videos from Ubisoft pages + allowlisted channels (with a key), each verified embeddable.
  // Creator scan: daily YouTube searches (needs the key); best ones also become stories.
  const searched = await searchVideos(videoConfig.searches ?? [], youtubeKey, now);
  const guideVideos = await fetchChannelVideos(videoConfig.guideCreators ?? [], youtubeKey, now);
  // Followed creators: their newest uploads cost ~2 quota units per channel (a search costs 100), so most
  // creator news comes from here; the few searches only discover new creators.
  const followed = await fetchChannelVideos(videoConfig.follow ?? [], youtubeKey, now);
  // Only videos from the last 24 hours become stories: with an update every 2 hours that is just what was
  // uploaded since the last few runs, so an update brings a handful of new videos, never a backlog of old ones.
  const recent = (v: { publishedAt: string }) => now.getTime() - Date.parse(v.publishedAt) <= 86_400_000;
  const storyPool = searched.filter(recent);
  for (const v of [...followed, ...guideVideos]) if (recent(v) && !storyPool.some((s) => s.id === v.id)) storyPool.push({ ...v, search: true });
  // Only videos never shown before compete for the 12 places. Ones already on the site stay anyway (today's
  // edition carries them), so older, more-viewed videos can't keep pushing today's new uploads out.
  const seen = dryRun ? new Map<string, string>() : await firstSeenIndex();
  const unseen = storyPool.filter((v) => !seen.has(stableId(`https://www.youtube.com/watch?v=${v.id}`)));
  const vStories = videoStories(unseen, now);
  log('info', 'video stories', { pool: storyPool.length, new: unseen.length, picked: vStories.length });
  for (const v of vStories) sourceText.set(v.id, storyPool.find((x) => x.id === v.videoId)?.description ?? v.title_orig);
  fresh.push(...vStories);
  // Video descriptions (from the YouTube API) for the scheduled 重點整理 writer, which can't load youtube.com
  // from the cloud. Input only, never shown on the site; kept 30 days.
  if (!dryRun) {
    const notes = await readJson<Record<string, { text: string; savedAt: string }>>('data/source-notes.json', {});
    for (const v of vStories) {
      const text = storyPool.find((x) => x.id === v.videoId)?.description?.trim();
      if (text && !notes[v.id]) notes[v.id] = { text, savedAt: now.toISOString() };
    }
    const cutoff = now.getTime() - 30 * 86_400_000;
    for (const [id, n] of Object.entries(notes)) if (Date.parse(n.savedAt) < cutoff) delete notes[id];
    await writeFile('data/source-notes.json', JSON.stringify(notes, null, 1) + '\n');
  }
  // 灰帽特工's posts: pick up new ones from his posts tab (missions, codes, maintenance…), then the newest run as stories.
  const creatorData = CreatorPostsSchema.parse(await readJson('data/creator-posts.json', { creator: {}, series: [], posts: [] }));
  if (!dryRun) {
    try {
      const feed = parsePostsPage(await politeGet(creatorData.creator.postsUrl));
      if (!feed.length) log('warn', 'creator posts: none found on the page (layout changed?)', {});
      const added = mergeFeed(creatorData, feed, now);
      if (added.missions.length || added.posts.length) log('info', 'creator posts added', added);
      await writeFile('data/creator-posts.json', JSON.stringify(CreatorPostsSchema.parse(creatorData), null, 2) + '\n');
    } catch (err) {
      log('warn', 'creator posts: could not read the posts tab', { error: String(err).slice(0, 200) });
    }
  }
  const cpStories = creatorPostStories(creatorData, now);
  for (const c of cpStories) sourceText.set(c.id, c.summary_zhHant);
  fresh.push(...cpStories);
  const videos = await buildVideos({
    searched: [...searched, ...followed.filter((v) => !searched.some((s) => s.id === v.id)), ...guideVideos],
    enHtml: results.find((r) => r.sourceId === 'ubisoft-en')?.body,
    zhHtml: results.find((r) => r.sourceId === 'ubisoft-zh-tw')?.body,
    previous: VideoLibrarySchema.parse(await readJson('data/videos.json', { videos: [] })).videos,
    channels,
    youtubeKey,
    now,
    dryRun,
  });

  // Exotic intel: official tables/mentions from Ubisoft posts + exotics newly added to the wiki (not in dry runs).
  const officialExotics = (results.find((r) => r.sourceId === 'ubisoft-en')?.items ?? []).flatMap(exoticsFromArticle);
  let spotted: Awaited<ReturnType<typeof wikiExotics>> = [];
  if (!dryRun) {
    try {
      spotted = await wikiExotics(now);
    } catch (err) {
      log('warn', 'wiki exotics failed', { error: String(err).slice(0, 120) });
    }
  }
  const exoticLog = ExoticLogSchema.parse(await readJson('data/exotics.json', { exotics: [] }));
  const exotics = { exotics: mergeExotics(exoticLog.exotics, [...officialExotics, ...spotted], now) };

  // Optional AI summaries (ANTHROPIC_API_KEY). 巴哈 previews are short, so read the thread's first post for those.
  const anthropicKey = dryRun ? undefined : process.env.ANTHROPIC_API_KEY;
  let ai = { applied: 0, costUsd: 0, skipped: 0 };
  const briefs = BriefsZhSchema.parse(await readJson('data/briefs.zh.json', { items: {} }));
  if (anthropicKey) {
    for (const item of fresh.filter((i) => i.sourceId === 'bahamut' && (needsAi(i) || !briefs.items[i.id])).slice(0, 8)) {
      try {
        sourceText.set(item.id, parseBahamutFirstPost(await politeGet(item.sourceUrl)) || (sourceText.get(item.id) ?? ''));
      } catch (err) {
        log('warn', 'bahamut post fetch failed', { id: item.id, error: String(err).slice(0, 80) });
      }
    }
    const glossary = (await readJson<{ terms: { en: string; zhHant: string }[] }>('data/glossary.json', { terms: [] })).terms;
    ai = await aiSummaries(
      fresh.map((item) => ({ item, text: sourceText.get(item.id) ?? item.title_orig })),
      { apiKey: anthropicKey, model: process.env.AI_MODEL, budgetUsd: Number(process.env.AI_DAILY_BUDGET_USD) || 0.5, glossary },
    );
    // 重點整理 for new stories, from what is left of the same budget.
    const written = await aiBriefs(
      fresh.map((item) => ({ item, text: sourceText.get(item.id) ?? '' })),
      briefs,
      { apiKey: anthropicKey, model: process.env.AI_MODEL, budgetUsd: Math.max(0, (Number(process.env.AI_DAILY_BUDGET_USD) || 0.5) - ai.costUsd), glossary, today: date },
    );
    ai.costUsd += written.costUsd;
    if (written.written) await writeFile('data/briefs.zh.json', JSON.stringify(BriefsZhSchema.parse(briefs), null, 2) + '\n');
  }

  // Events (curated + read from Ubisoft notes) and 攻略精選 guides that expire with their event.
  const eventLog = GameEventLogSchema.parse(await readJson('data/events.json', { events: [] }));
  const events = mergeEvents(eventLog.events, (results.find((x) => x.sourceId === 'ubisoft-en')?.items ?? []).flatMap(eventsFromArticle));
  const picksFile = await readJson<{ picks: Pick[] }>('data/picks.json', { picks: [] });
  const pickGuides = guidesFromPicks(picksFile.picks, events);
  if (!dryRun) {
    for (const p of pickGuides.filter((x) => x.kind === 'video' && x.videoId)) {
      if ((await checkEmbeddable(p.videoId!)).ok) p.checkedAt = now.toISOString();
      else p.until = '1970-01-01'; // no longer playable: drop it
    }
  }
  const previousGuides = GuideLogSchema.parse(await readJson('data/guides.json', { guides: [] })).guides;
  const guides = { guides: liveGuides(mergeGuides(previousGuides, [...guidesFromVideos(guideVideos, events, now), ...pickGuides]), now) };

  // Video stories come from YouTube searches, which can fail (e.g. quota used up, HTTP 429). Keep the ones this
  // day's edition already has, so a failed search never makes them vanish (or orphans their 重點整理).
  if (!dryRun) {
    try {
      const today = EditionSchema.parse(JSON.parse(await readFile(join('data/editions', `${date}.json`), 'utf8')));
      const have = new Set(fresh.map((i) => i.id));
      const kept = today.items.filter((i) => i.sourceId === 'youtube' && !have.has(i.id));
      fresh.push(...kept);
      if (kept.length) log('info', 'kept video stories from earlier today', { count: kept.length });
    } catch {}
  }

  const overrides = OverridesSchema.parse(await readJson('data/overrides.json', {}));
  const edition = assembleEdition({ date, now, fresh, results, previous: await previousEdition(date), overrides, firstSeen: dryRun ? new Map() : await firstSeenIndex() });
  // 巴哈 pinned daily threads make one story per day from the same link: keep only the newest day.
  {
    const newest = new Map<string, Item>();
    for (const i of edition.items) {
      if (i.sourceId !== 'bahamut') continue;
      const was = newest.get(i.sourceUrl);
      if (!was || i.publishedAt > was.publishedAt) newest.set(i.sourceUrl, i);
    }
    edition.items = edition.items.filter((i) => i.sourceId !== 'bahamut' || newest.get(i.sourceUrl) === i);
  }

  const outDir = dryRun ? '.dry-run' : 'data';
  await mkdir(join(outDir, 'editions'), { recursive: true });
  await writeFile(join(outDir, 'editions', `${date}.json`), JSON.stringify(edition, null, 2) + '\n');
  await writeFile(join(outDir, 'images.json'), JSON.stringify(ImageLibrarySchema.parse(images), null, 2) + '\n');
  await writeFile(join(outDir, 'videos.json'), JSON.stringify(VideoLibrarySchema.parse({ videos }), null, 2) + '\n');
  await writeFile(join(outDir, 'events.json'), JSON.stringify(GameEventLogSchema.parse({ _note: eventLog._note, events }), null, 2) + '\n');
  await writeFile(join(outDir, 'guides.json'), JSON.stringify(GuideLogSchema.parse(guides), null, 2) + '\n');
  await writeFile(join(outDir, 'exotics.json'), JSON.stringify(ExoticLogSchema.parse(exotics), null, 2) + '\n');
  await writeFile(join(outDir, 'patches.json'), JSON.stringify(PatchLogSchema.parse(patches), null, 2) + '\n');

  // Status page data: only counts and booleans, never key values.
  const status = RunStatusSchema.parse({
    lastRun: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    edition: { date, number: edition.editionNumber, items: edition.items.length, zhPending: edition.items.filter((i) => i.headline_zhHant === 'pending').length },
    sources: results.map((r) => ({ id: r.sourceId, ok: r.ok, items: r.items.length, ...(r.note ? { note: r.note } : {}) })),
    videos: { total: videos.length, youtubeApiConfigured: Boolean(youtubeKey) },
    budget: { youtubeQuotaUnits: youtubeKey ? channels.length * 2 + (videoConfig.searches?.length ?? 0) * 100 + 1 : 0, costUsd: Number(ai.costUsd.toFixed(4)) },
  });
  await writeFile(join(outDir, 'status.json'), JSON.stringify(status, null, 2) + '\n');

  // Retention: remove YouTube-derived stories from editions older than 30 days.
  if (!dryRun) {
    for (const file of (await readdir('data/editions').catch(() => [] as string[])).filter((f) => f.endsWith('.json'))) {
      const old = EditionSchema.parse(JSON.parse(await readFile(join('data/editions', file), 'utf8')));
      const scrubbed = scrubOldYoutube(old, now);
      if (scrubbed) {
        await writeFile(join('data/editions', file), JSON.stringify(scrubbed, null, 2) + '\n');
        log('info', 'youtube retention scrub', { edition: old.date });
      }
    }
  }

  const pending = edition.items.filter((i) => i.headline_zhHant === 'pending').length;
  log('info', 'refresh done', {
    out: join(outDir, 'editions', `${date}.json`),
    edition: edition.editionNumber,
    items: edition.items.length,
    zhPending: pending,
    videos: videos.length,
    sourcesDown: edition.sources.filter((s) => !s.ok).map((s) => s.sourceId),
    estimatedCostUsd: 0,
  });
}

main().catch((err) => {
  log('error', 'refresh failed', { error: String(err) });
  process.exit(1);
});
