/**
 * Exotic intel: what new exotics exist or are coming, and their talents.
 * 1. Official: Ubisoft patch-note tables ("| **Name**<br>Exotic Type | **Talent X**<br><br>…") and
 *    sentences like "introduces a new Exotic Weapon, The Ratel". PTS posts ⇒ "pts" (coming soon).
 * 2. Community: pages newly added to the Division wiki's Exotic category (CC BY-SA, credited + linked).
 */
import type { Exotic } from '../src/schema/item.ts';
import { MAX_QUOTE_WORDS } from './config.ts';
import { politeGet } from './http.ts';
import { log } from './log.ts';
import type { RawItem } from './sources/types.ts';
import { extractWords, toPlainText } from './text.ts';

const TYPES = 'Light Machine Gun|Submachine Gun|Assault Rifle|Marksman Rifle|Sniper Rifle|Rifle|SMG|LMG|Shotgun|Pistol|Gloves|Chest|Backpack|Mask|Holster|Kneepads|Weapon';
const TABLE_ROW = new RegExp(`^\\|\\s*\\*\\*([^*|]{2,40})\\*\\*\\s*(?:<br>\\s*)+Exotic\\s+(${TYPES})\\s*\\|\\s*\\*\\*Talent\\s+([^*|]{2,40})\\*\\*((?:\\s*<br>)*)([^|]*)`, 'i');
const MENTION = new RegExp(`new Exotic (${TYPES}),?\\s+(?:called\\s+|named\\s+)?(?:the\\s+)?([A-Z][\\w'’&-]+(?:\\s[A-Z][\\w'’&-]+){0,2})`, 'g');

const key = (name: string) => name.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
const statusFor = (title: string): Exotic['status'] => (/\bPTS\b/i.test(title) ? 'pts' : /\[?TU ?Y\d+S\d+/i.test(title) ? 'released' : 'announced');

/** Official exotics mentioned in one Ubisoft article. */
export function exoticsFromArticle(a: RawItem): Exotic[] {
  const status = statusFor(a.title);
  const source = { name: 'Ubisoft', url: a.url };
  const found = new Map<string, Exotic>();
  for (const line of a.rawBody.split(/\r?\n/)) {
    const m = line.match(TABLE_ROW);
    if (!m) continue;
    const name = m[1]!.trim();
    found.set(key(name), {
      name,
      type: m[2]!.replace(/\b\w/g, (c) => c.toUpperCase()),
      talent: m[3]!.trim(),
      text: extractWords(toPlainText(m[5]!.replace(/<br>/gi, ' ')), MAX_QUOTE_WORDS) || undefined,
      status,
      confidence: 'official',
      firstSeen: a.publishedAt,
      sources: [source],
    });
  }
  for (const m of toPlainText(a.rawBody).matchAll(MENTION)) {
    const name = m[2]!.trim();
    if (found.has(key(name)) || /^(Weapon|Gear|Exotic)$/i.test(name)) continue;
    found.set(key(name), { name, type: m[1], status, confidence: 'official', firstSeen: a.publishedAt, sources: [source] });
  }
  return [...found.values()];
}

/** First sentence of a wiki page's lead, as plain text. */
export function wikiLead(wikitext: string): string {
  const plain = wikitext
    .replace(/\{\{Exotic\|([^}|]+)\}\}/gi, '$1')
    .replace(/\{\{[^{}]*\}\}/g, ' ')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/<ref[\s\S]*?<\/ref>|<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.match(/^[^.!?]+[.!?]/)?.[0] ?? plain.slice(0, 200);
}

const WIKI = 'https://thedivision.fandom.com';
const WIKI_API = `${WIKI}/api.php`;
const WIKI_DAYS = 60;

/** Exotics added to the wiki's "Exotic" category in the last 60 days (Division 2 pages only). */
export async function wikiExotics(now: Date, get = politeGet, max = 12): Promise<Exotic[]> {
  const list = JSON.parse(
    await get(`${WIKI_API}?action=query&list=categorymembers&cmtitle=Category:Exotic&cmnamespace=0&cmsort=timestamp&cmdir=desc&cmlimit=${max}&cmprop=title|timestamp&format=json`),
  ) as { query?: { categorymembers?: { title: string; timestamp: string }[] } };
  const recent = (list.query?.categorymembers ?? []).filter((p) => now.getTime() - Date.parse(p.timestamp) < WIKI_DAYS * 86_400_000);
  const out: Exotic[] = [];
  for (const p of recent) {
    try {
      const page = JSON.parse(await get(`${WIKI_API}?action=parse&page=${encodeURIComponent(p.title)}&prop=wikitext&section=0&format=json`)) as {
        parse?: { wikitext?: { '*': string } };
      };
      const lead = wikiLead(page.parse?.wikitext?.['*'] ?? '');
      if (!/Division 2/i.test(lead)) continue; // the category also holds Division 1 items
      out.push({
        name: p.title.replace(/\s*\([^)]*\)$/, ''),
        type: lead.match(new RegExp(`Exotic\\s+(${TYPES})`, 'i'))?.[1],
        text: extractWords(lead, MAX_QUOTE_WORDS),
        status: 'spotted',
        confidence: 'community',
        firstSeen: new Date(p.timestamp).toISOString(),
        sources: [{ name: 'The Division Wiki (CC BY-SA)', url: `${WIKI}/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}` }],
      });
    } catch (err) {
      log('warn', 'wiki page failed', { page: p.title, error: String(err).slice(0, 80) });
    }
  }
  return out;
}

const RANK: Record<Exotic['status'], number> = { released: 3, pts: 2, announced: 1, spotted: 0 };
const KEEP_DAYS = 120;

/** Merge into the running log: official info wins, sources accumulate, earliest sighting kept. */
export function mergeExotics(existing: Exotic[], fresh: Exotic[], now: Date): Exotic[] {
  const byKey = new Map(existing.map((e) => [key(e.name), e]));
  for (const f of fresh) {
    const old = byKey.get(key(f.name));
    if (!old) {
      byKey.set(key(f.name), f);
      continue;
    }
    const best = RANK[f.status] > RANK[old.status] || (f.confidence === 'official' && old.confidence !== 'official') ? f : old;
    const sources = [...old.sources, ...f.sources.filter((s) => !old.sources.some((o) => o.url === s.url))];
    byKey.set(key(f.name), {
      ...old,
      ...best,
      type: best.type ?? old.type ?? f.type,
      talent: best.talent ?? old.talent ?? f.talent,
      text: best.text ?? old.text ?? f.text,
      confidence: old.confidence === 'official' || f.confidence === 'official' ? 'official' : 'community',
      firstSeen: old.firstSeen < f.firstSeen ? old.firstSeen : f.firstSeen,
      sources,
    });
  }
  return [...byKey.values()]
    .filter((e) => now.getTime() - Date.parse(e.firstSeen) < KEEP_DAYS * 86_400_000)
    .sort((a, b) => b.firstSeen.localeCompare(a.firstSeen));
}
