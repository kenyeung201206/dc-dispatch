/**
 * When ProtoTrack lists a reward we don't have in data/brands.json (a new brand, gear set or item), take its icon
 * from ProtoTrack's own page (white emblem, the same style as ours), save it as a 96x96 PNG in public/icons/, and
 * add the name to data/brands.json with `auto: true` and no Chinese name. The Chinese name is added by hand later,
 * from a source that confirms it, never guessed. ProtoTrack's robots.txt allows this; it's one page plus one image.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { USER_AGENT } from './config.ts';
import { assertAllowedUrl, politeGet } from './http.ts';
import { log } from './log.ts';
import { knownReward, PROTOTRACK_PAGE } from './sources/prototrack.ts';

const BRANDS_FILE = 'data/brands.json';
type Entry = { en: string; aliases: string[]; icon: string | null; auto?: boolean };
type Brands = { brands: Entry[]; sets: Entry[]; slots: Entry[] };

/** ProtoTrack's asset folder → our list and icon folder. */
const FOLDERS: Record<string, [keyof Brands, string]> = {
  brandsets: ['brands', 'brand'],
  gearsets: ['sets', 'set'],
  weapons: ['slots', 'weapon'],
  gear: ['slots', 'gear'],
};

/** Every `<img … src=… data-loot="Name">` on ProtoTrack's page → name, image URL and our list/folder. */
export function iconsOnPage(html: string): { name: string; url: string; list: keyof Brands; folder: string }[] {
  const out = [];
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    const name = /data-loot="([^"]+)"/.exec(tag)?.[1]?.replace(/&amp;/g, '&');
    const src = /\ssrc="([^"]+)"/.exec(tag)?.[1];
    const folder = src && /\/assets\/division2\/([a-z]+)\/[^/]+\.png/.exec(src)?.[1];
    const dest = folder ? FOLDERS[folder] : undefined;
    if (name && src && dest) out.push({ name, url: new URL(src, PROTOTRACK_PAGE).href, list: dest[0], folder: dest[1] });
  }
  return out;
}

export const slug = (s: string) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function getImage(raw: string): Promise<Buffer> {
  const res = await fetch(assertAllowedUrl(raw), { headers: { 'user-agent': USER_AGENT }, redirect: 'error', signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 2_000_000) throw new Error('image too large');
  return buf;
}

/** Same look as our other icons: emblem trimmed, fitted into 88px, 4px clear edge, transparent background. */
export async function toIcon(png: Buffer): Promise<Buffer> {
  const clear = { r: 0, g: 0, b: 0, alpha: 0 };
  const trimmed = await sharp(png).ensureAlpha().trim().toBuffer();
  return sharp(trimmed).resize(88, 88, { fit: 'contain', background: clear }).extend({ top: 4, bottom: 4, left: 4, right: 4, background: clear }).png().toBuffer();
}

/** Adds icons for any of `names` we don't know. Returns the names added. */
export async function addMissingIcons(names: string[]): Promise<string[]> {
  const missing = [...new Set(names)].filter((n) => !knownReward(n));
  if (!missing.length) return [];
  const page = iconsOnPage(await politeGet(PROTOTRACK_PAGE, { retries: 1 }));
  const brands = JSON.parse(await readFile(BRANDS_FILE, 'utf8')) as Brands;
  const added: string[] = [];
  for (const name of missing) {
    const hit = page.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (!hit) {
      log('warn', 'loot icon: not on ProtoTrack page', { name });
      continue;
    }
    try {
      const icon = `/icons/${hit.folder}/${slug(name)}.png`;
      await mkdir(`public/icons/${hit.folder}`, { recursive: true });
      await writeFile(`public${icon}`, await toIcon(await getImage(hit.url)));
      brands[hit.list].push({ en: name, aliases: [name], icon, auto: true });
      added.push(name);
      log('info', 'loot icon added (needs a Chinese name)', { name, icon });
    } catch (err) {
      log('warn', 'loot icon failed', { name, error: String(err).slice(0, 120) });
    }
  }
  if (added.length) await writeFile(BRANDS_FILE, JSON.stringify(brands, null, 1) + '\n');
  return added;
}
