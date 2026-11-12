/**
 * 攻略精選 / Guide Picks.
 * - Events: curated list (data/events.json) + events read from Ubisoft notes ("EVENT … From November 17 to November 26").
 * - Guides: new videos from guide creators (YouTube API, needs the key) + editor picks (data/picks.json).
 * - Expiry: a guide matched to an event shows until the event's last day; otherwise 60 days after publishing.
 */
import type { GameEvent, Guide } from '../src/schema/item.ts';
import type { RawItem } from './sources/types.ts';
import { stableId, toPlainText } from './text.ts';
import type { VideoCandidate } from './video/videos.ts';

export const DEFAULT_GUIDE_DAYS = 60;
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const DATE = '(January|February|March|April|May|June|July|August|September|October|November|December) (\\d{1,2})';

const tokyoDate = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const addDays = (iso: string, days: number) => tokyoDate(new Date(Date.parse(iso) + days * 86_400_000));

/** "EVENT" headings in Ubisoft notes followed by "From <Month D> to <Month D>". */
export function eventsFromArticle(a: RawItem): GameEvent[] {
  const out: GameEvent[] = [];
  const year = Number(a.publishedAt.slice(0, 4));
  const re = new RegExp(`^#{1,3}\\s+([^\\n{#]*EVENT[^\\n{#]*)[^\\n]*\\n+[^\\n]*?From ${DATE} (?:to|until|through|-|–) ${DATE}`, 'gim');
  for (const m of a.rawBody.matchAll(re)) {
    const name = toPlainText(m[1]!).replace(/\b\w+/g, (w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase()).trim();
    const mo1 = MONTHS.indexOf(m[2]!.toLowerCase());
    const mo2 = MONTHS.indexOf(m[4]!.toLowerCase());
    const y2 = mo2 < mo1 ? year + 1 : year;
    const pad = (n: number) => String(n).padStart(2, '0');
    const short = name.replace(/\s+(Project|Event)$/i, '');
    out.push({
      id: `auto-${stableId(a.url, name)}`,
      name_en: name,
      name_zhHant: name,
      start: `${year}-${pad(mo1 + 1)}-${pad(Number(m[3]))}`,
      end: `${y2}-${pad(mo2 + 1)}-${pad(Number(m[5]))}`,
      match: [short],
      source: a.url,
      auto: true,
    });
  }
  return out;
}

/** Curated events win; auto events are added only if no curated event covers the same name. */
export function mergeEvents(curated: GameEvent[], auto: GameEvent[]): GameEvent[] {
  const covered = (e: GameEvent) => curated.some((c) => c.match.some((m) => e.name_en.toLowerCase().includes(m.toLowerCase())));
  return [...curated, ...auto.filter((e) => !covered(e) && !curated.some((c) => c.id === e.id))];
}

export function matchEvent(title: string, events: GameEvent[]): GameEvent | undefined {
  const t = title.toLowerCase();
  return events.find((e) => e.match.some((m) => t.includes(m.toLowerCase())));
}

export function untilFor(title: string, publishedAt: string, events: GameEvent[]): { until: string; eventId?: string } {
  const ev = matchEvent(title, events);
  return ev ? { until: ev.end, eventId: ev.id } : { until: addDays(publishedAt, DEFAULT_GUIDE_DAYS) };
}

/** New uploads from guide creators ⇒ guides. */
export function guidesFromVideos(videos: VideoCandidate[], events: GameEvent[], now: Date): Guide[] {
  return videos.map((v) => ({
    id: `yt-${v.id}`,
    kind: 'video',
    videoId: v.id,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    title: cleanTitle(v.title),
    channelName: v.channelName ?? 'YouTube',
    channelUrl: v.channelUrl ?? `https://www.youtube.com/watch?v=${v.id}`,
    publishedAt: v.publishedAt,
    addedBy: 'auto',
    checkedAt: now.toISOString(),
    ...untilFor(v.title, v.publishedAt, events),
  }));
}

/** Keep guides that haven't expired; YouTube-derived ones must also have been confirmed within 30 days. */
export function liveGuides(guides: Guide[], now: Date): Guide[] {
  const today = tokyoDate(now);
  return guides
    .filter((g) => g.until >= today)
    .filter((g) => g.kind !== 'video' || !g.checkedAt || now.getTime() - Date.parse(g.checkedAt) <= 30 * 86_400_000)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function mergeGuides(previous: Guide[], fresh: Guide[]): Guide[] {
  const byId = new Map(previous.map((g) => [g.id, g]));
  for (const g of fresh) byId.set(g.id, { ...byId.get(g.id), ...g });
  return [...byId.values()];
}

export interface Pick {
  kind: 'video' | 'post';
  videoId?: string;
  url?: string;
  title: string;
  channelName: string;
  channelUrl: string;
  summary_zhHant?: string;
  summary_en?: string;
  until?: string;
  eventId?: string;
  added: string;
}

/** Hashtags and trailing tag clouds aren't part of a title. */
export const cleanTitle = (t: string) => t.replace(/#\S+/g, ' ').replace(/\s+/g, ' ').trim();

export function guidesFromPicks(picks: Pick[], events: GameEvent[]): Guide[] {
  return picks.map((p) => {
    const url = p.kind === 'video' && p.videoId ? `https://www.youtube.com/watch?v=${p.videoId}` : p.url!;
    const publishedAt = new Date(`${p.added}T00:00:00+08:00`).toISOString();
    const ev = p.eventId ? events.find((e) => e.id === p.eventId) : undefined;
    const timing = p.until ? { until: p.until, eventId: p.eventId } : ev ? { until: ev.end, eventId: ev.id } : untilFor(p.title, publishedAt, events);
    return {
      id: p.kind === 'video' && p.videoId ? `yt-${p.videoId}` : `post-${stableId(url)}`,
      kind: p.kind,
      ...(p.videoId ? { videoId: p.videoId } : {}),
      url,
      title: cleanTitle(p.title),
      channelName: p.channelName,
      channelUrl: p.channelUrl,
      publishedAt,
      ...(p.summary_zhHant ? { summary_zhHant: p.summary_zhHant } : {}),
      ...(p.summary_en ? { summary_en: p.summary_en } : {}),
      addedBy: 'editor' as const,
      ...timing,
    };
  });
}
