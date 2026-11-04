import type { Category } from '../src/schema/item.ts';

/** Identifies the pipeline politely, with no personal contact details. */
export const USER_AGENT = 'Mozilla/5.0 (compatible; DCDispatchBot/0.1; private fan newspaper)';

/** The fetcher refuses any host not on this list (SSRF guard). */
export const ALLOWED_HOSTS = new Set(['api.steampowered.com', 'www.ubisoft.com', 'www.youtube.com', 'www.googleapis.com']);

export const TIMEZONE = 'Asia/Tokyo';
export const STEAM_APP_ID = 2221490;

/** Stories older than this drop out of the edition (active glitches are kept). */
export const WINDOW_DAYS = 21;
export const MAX_ITEMS = 40;
/** Extracts quoted from a source stay at or under this many words (brief §4.4). */
export const MAX_QUOTE_WORDS = 25;

export const SOURCES = {
  'steam-news': {
    name: 'Steam News',
    url: `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=${STEAM_APP_ID}&count=30&maxlength=1500&format=json`,
    authority: 30,
  },
  'ubisoft-en': {
    name: 'Ubisoft',
    url: 'https://www.ubisoft.com/en-us/game/the-division/the-division-2/news-updates',
    authority: 40,
  },
  'ubisoft-zh-tw': {
    name: 'Ubisoft 台灣',
    url: 'https://www.ubisoft.com/zh-tw/game/the-division/the-division-2/news-updates',
    authority: 40,
  },
} as const;
export type SourceId = keyof typeof SOURCES;

/** Steam feeds treated as official; other English feeds count as press ("reported"). */
export const STEAM_OFFICIAL_FEEDS = new Set(['steam_community_announcements']);

/** Classification rules, checked in order; first match wins. Matched against title + text. */
export const CATEGORY_RULES: { category: Category; pattern: RegExp }[] = [
  { category: 'franchise', pattern: /\b(resurgence|heartland|division 3|the division 3)\b/i },
  { category: 'glitch-watch', pattern: /\b(known issues?|exploit|glitch|bug report|workaround)\b/i },
  { category: 'community', pattern: /\b(twitch drops?|drops|creator collaboration|community|referral|giveaway)\b/i },
  { category: 'updates', pattern: /\b(title update|TU ?Y\d+S\d+(\.\d+)?|patch notes?|hotfix|maintenance|PTS|server)\b/i },
  { category: 'dark-zone', pattern: /\b(dark zone|pvp|conflict|rogue)\b/i },
  { category: 'arsenal', pattern: /\b(exotic|named (weapon|item)|gear set|talent|brand set)\b/i },
  { category: 'builds', pattern: /\b(build|meta|tier list)\b/i },
  { category: 'missions', pattern: /\b(dlc|expansion|season|mission|raid|manhunt|incursion|event|story|showcase)\b/i },
];

/** Keyword bonuses for importance (configurable). */
export const KEYWORD_WEIGHTS: [RegExp, number][] = [
  [/\b(dlc|expansion)\b/i, 15],
  [/\b(title update|TU ?Y\d+S\d+)/i, 12],
  [/\bcrossplay\b/i, 8],
  [/\bhotfix\b/i, 10],
  [/\bexploit\b/i, 10],
  [/\bseason\b/i, 8],
  [/\braid\b/i, 8],
  [/\bexotic\b/i, 6],
  [/\bevent\b/i, 5],
  [/\bknown issue/i, 4],
];

/** Masthead season label. Update when a new season starts (see docs/RUNBOOK.md). */
export const SEASON = { season_en: 'Red Horizon', season_zhHant: 'Red Horizon 賽季', titleUpdate: 'TU Y8S3.3' };

export const CONFIDENCE_BASE = { official: 40, reported: 25, rumour: 10 } as const;
