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
import { EditionSchema, ImageLibrarySchema, type Edition, type Item } from '../src/schema/item.ts';
import { SOURCES, TIMEZONE, type SourceId } from './config.ts';
import { dedupe } from './dedupe.ts';
import { assembleEdition, OverridesSchema } from './edition.ts';
import { politeGet } from './http.ts';
import { log } from './log.ts';
import { storyToItems } from './normalize.ts';
import { parseSteamNews } from './sources/steam.ts';
import type { RawItem, SourceResult } from './sources/types.ts';
import { parseUbisoftNews } from './sources/ubisoft.ts';

const { values: args } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    date: { type: 'string' },
  },
});
const dryRun = args['dry-run'];

const FIXTURES: Record<SourceId, string> = {
  'steam-news': 'tests/fixtures/sources/steam-news.json',
  'ubisoft-en': 'tests/fixtures/sources/ubisoft-en.html',
  'ubisoft-zh-tw': 'tests/fixtures/sources/ubisoft-zh-tw.html',
};
const PARSERS: Record<SourceId, (body: string) => RawItem[]> = {
  'steam-news': parseSteamNews,
  'ubisoft-en': (b) => parseUbisoftNews(b, 'ubisoft-en'),
  'ubisoft-zh-tw': (b) => parseUbisoftNews(b, 'ubisoft-zh-tw'),
};

async function runSource(id: SourceId): Promise<SourceResult> {
  try {
    const body = dryRun ? await readFile(FIXTURES[id], 'utf8') : await politeGet(SOURCES[id].url);
    const items = PARSERS[id](body);
    log('info', 'source ok', { source: id, items: items.length });
    if (!items.length) return { sourceId: id, ok: false, items, note: 'no items parsed (layout change?)' };
    return { sourceId: id, ok: true, items };
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

async function main() {
  // Dry runs are pinned to the fixtures' date so results are reproducible.
  const now = args.date
    ? new Date(`${args.date}T06:00:00+09:00`)
    : dryRun
      ? new Date('2026-11-04T06:00:00+09:00')
      : new Date();
  const date = tokyoDate(now);
  log('info', 'refresh start', { date, dryRun });

  const results = await Promise.all((Object.keys(SOURCES) as SourceId[]).map(runSource));
  const zhById = new Map(results.find((r) => r.sourceId === 'ubisoft-zh-tw')!.items.map((i) => [i.externalId, i]));
  const english = results.filter((r) => r.sourceId !== 'ubisoft-zh-tw').flatMap((r) => r.items);

  const images = ImageLibrarySchema.parse(await readJson('data/images.json', {}));
  const stories = dedupe(english);
  const fresh: Item[] = stories.flatMap((s) => storyToItems(s, { now, zhById, images }));
  log('info', 'processed', { raw: english.length, stories: stories.length, items: fresh.length });

  const overrides = OverridesSchema.parse(await readJson('data/overrides.json', {}));
  const edition = assembleEdition({ date, now, fresh, results, previous: await previousEdition(date), overrides });

  const outDir = dryRun ? '.dry-run' : 'data';
  await mkdir(join(outDir, 'editions'), { recursive: true });
  await writeFile(join(outDir, 'editions', `${date}.json`), JSON.stringify(edition, null, 2) + '\n');
  await writeFile(join(outDir, 'images.json'), JSON.stringify(ImageLibrarySchema.parse(images), null, 2) + '\n');

  const pending = edition.items.filter((i) => i.headline_zhHant === 'pending').length;
  log('info', 'refresh done', {
    out: join(outDir, 'editions', `${date}.json`),
    edition: edition.editionNumber,
    items: edition.items.length,
    zhPending: pending,
    sourcesDown: edition.sources.filter((s) => !s.ok).map((s) => s.sourceId),
    estimatedCostUsd: 0,
  });
}

main().catch((err) => {
  log('error', 'refresh failed', { error: String(err) });
  process.exit(1);
});
