/**
 * Finds Division 2 creators we don't follow yet. Searches (100 quota units each) only see the newest 50 videos,
 * so a channel we don't follow is caught only by luck. Every channel whose Division 2 videos turn up in the
 * searches is counted; once 3 different videos of theirs have been found, it joins `follow` in
 * data/video-channels.json, where all its new uploads cost ~2 units a run. Capped at MAX_FOLLOW channels.
 */
export const DISCOVER_AFTER = 3;
/** Chinese creators are scarcer and readers want Chinese (owner, 2026-11-25): followed after 2 videos, and first. */
export const DISCOVER_AFTER_ZH = 2;
export const MAX_FOLLOW = 80; // 60 → 80 (2026-11-25) so Chinese creators found now have room; ~2 quota units each per run

type Channel = { id: string; name: string; official: boolean };
export interface CreatorConfig {
  channels?: Channel[];
  guideCreators?: Channel[];
  follow?: Channel[];
  /** Channels seen in searches but not followed yet: channel id → name and the video ids found. */
  discovered?: Record<string, { name: string; videos: string[]; firstSeen: string; zh?: boolean }>;
}

const channelId = (url: string) => /\/channel\/(UC[\w-]{22})/.exec(url)?.[1];

/** Updates `discovered` and moves creators with enough videos into `follow`. Returns the names added. */
export function trackCreators(
  config: CreatorConfig,
  found: { id: string; title?: string; channelName?: string; channelUrl?: string; official?: boolean }[],
  now: Date,
): string[] {
  const known = new Set([...(config.channels ?? []), ...(config.guideCreators ?? []), ...(config.follow ?? [])].map((c) => c.id));
  const d = (config.discovered ??= {});
  for (const v of found) {
    const id = channelId(v.channelUrl ?? '');
    if (!id || known.has(id) || v.official) continue;
    const e = (d[id] ??= { name: v.channelName ?? id, videos: [], firstSeen: now.toISOString() });
    if (v.channelName) e.name = v.channelName;
    if (!e.videos.includes(v.id)) e.videos = [...e.videos, v.id].slice(-10);
    if (/[\u3400-\u9fff]/.test(`${v.title ?? ''}${v.channelName ?? ''}`)) e.zh = true;
  }
  const added: string[] = [];
  const follow = (config.follow ??= []);
  // Most videos first, so the most active creators get the free places.
  const enough = (e: { videos: string[]; zh?: boolean }) => e.videos.length >= (e.zh ? DISCOVER_AFTER_ZH : DISCOVER_AFTER);
  const order = Object.entries(d).sort((a, b) => Number(Boolean(b[1].zh)) - Number(Boolean(a[1].zh)) || b[1].videos.length - a[1].videos.length);
  for (const [id, e] of order) {
    if (!enough(e) || follow.length >= MAX_FOLLOW) continue;
    follow.push({ id, name: e.name, official: false });
    delete d[id];
    added.push(e.name);
  }
  // Forget one-off channels after 30 days so the list stays small.
  for (const [id, e] of Object.entries(d)) if (now.getTime() - Date.parse(e.firstSeen) > 30 * 86_400_000 && !enough(e)) delete d[id];
  return added;
}
