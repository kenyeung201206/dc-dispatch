/**
 * Twitch Helix lookup for "Live Now". Runs on the server (Cloudflare Pages Function), never in the browser,
 * so the app credentials stay secret. Nothing is stored: Twitch data is fetched on demand and cached
 * for 5 minutes, well inside the 24-hour limit for unauthenticated Helix data.
 */

export interface TwitchEnv {
  TWITCH_CLIENT_ID?: string;
  TWITCH_CLIENT_SECRET?: string;
}

export interface LiveStream {
  login: string;
  name: string;
  title: string;
  viewers: number;
  startedAt: string;
  thumbnail: string;
  language: string;
}

export interface Clip {
  id: string;
  title: string;
  broadcaster: string;
  views: number;
  createdAt: string;
  thumbnail: string;
  url: string;
  duration: number;
}

export interface LiveResponse {
  status: 'live' | 'offline' | 'unconfigured' | 'error';
  streams: LiveStream[];
  clips: Clip[];
  fetchedAt: string;
}

const GAME_NAME = "Tom Clancy's The Division 2";
const THUMB_HOSTS = /^https:\/\/(static-cdn\.jtvnw\.net|clips-media-assets2\.twitch\.tv)\//;
const LOGIN = /^[a-zA-Z0-9_]{3,25}$/;
const CLIP_ID = /^[A-Za-z0-9_-]{4,100}$/;

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

let token: { value: string; expires: number } | undefined;
let gameId: string | undefined;

/** Reset module caches (tests). */
export function _reset() {
  token = undefined;
  gameId = undefined;
}

async function appToken(env: Required<TwitchEnv>, f: Fetch, now: number): Promise<string> {
  if (token && token.expires > now + 60_000) return token.value;
  const body = new URLSearchParams({
    client_id: env.TWITCH_CLIENT_ID,
    client_secret: env.TWITCH_CLIENT_SECRET,
    grant_type: 'client_credentials',
  });
  const res = await f('https://id.twitch.tv/oauth2/token', { method: 'POST', body });
  if (!res.ok) throw new Error(`token HTTP ${res.status}`);
  const j = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new Error('no access_token');
  token = { value: j.access_token, expires: now + (j.expires_in ?? 3600) * 1000 };
  return token.value;
}

async function helix<T>(path: string, env: Required<TwitchEnv>, f: Fetch, now: number): Promise<T> {
  const res = await f(`https://api.twitch.tv/helix/${path}`, {
    headers: { 'Client-Id': env.TWITCH_CLIENT_ID, Authorization: `Bearer ${await appToken(env, f, now)}` },
  });
  if (res.status === 401) token = undefined;
  if (!res.ok) throw new Error(`helix ${path.split('?')[0]} HTTP ${res.status}`);
  return (await res.json()) as T;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export async function getLive(env: TwitchEnv, f: Fetch = fetch, now = Date.now()): Promise<LiveResponse> {
  const fetchedAt = new Date(now).toISOString();
  if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) return { status: 'unconfigured', streams: [], clips: [], fetchedAt };
  const e = env as Required<TwitchEnv>;
  try {
    if (!gameId) {
      const g = await helix<{ data?: { id?: string }[] }>(`games?name=${encodeURIComponent(GAME_NAME)}`, e, f, now);
      gameId = str(g.data?.[0]?.id);
      if (!gameId) throw new Error('game not found');
    }
    const since = new Date(now - 7 * 86_400_000).toISOString();
    const [s, c] = await Promise.all([
      helix<{ data?: Record<string, unknown>[] }>(`streams?game_id=${gameId}&first=12`, e, f, now),
      helix<{ data?: Record<string, unknown>[] }>(`clips?game_id=${gameId}&first=8&started_at=${since}`, e, f, now),
    ]);
    const streams: LiveStream[] = (s.data ?? [])
      .map((d) => ({
        login: str(d.user_login),
        name: str(d.user_name),
        title: str(d.title).slice(0, 140),
        viewers: num(d.viewer_count),
        startedAt: str(d.started_at),
        thumbnail: str(d.thumbnail_url).replace('{width}', '440').replace('{height}', '248'),
        language: str(d.language),
      }))
      .filter((x) => LOGIN.test(x.login) && THUMB_HOSTS.test(x.thumbnail));
    const clips: Clip[] = (c.data ?? [])
      .map((d) => ({
        id: str(d.id),
        title: str(d.title).slice(0, 140),
        broadcaster: str(d.broadcaster_name),
        views: num(d.view_count),
        createdAt: str(d.created_at),
        thumbnail: str(d.thumbnail_url),
        url: str(d.url),
        duration: num(d.duration),
      }))
      .filter((x) => CLIP_ID.test(x.id) && THUMB_HOSTS.test(x.thumbnail) && x.url.startsWith('https://clips.twitch.tv/'));
    return { status: streams.length ? 'live' : 'offline', streams, clips, fetchedAt };
  } catch {
    return { status: 'error', streams: [], clips: [], fetchedAt };
  }
}
