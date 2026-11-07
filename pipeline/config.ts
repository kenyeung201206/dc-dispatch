import type { Category } from '../src/schema/item.ts';

/** Identifies the pipeline politely, with no personal contact details. */
export const USER_AGENT = 'Mozilla/5.0 (compatible; DCDispatchBot/0.1; private fan newspaper)';

/** The fetcher refuses any host not on this list (SSRF guard). */
export const ALLOWED_HOSTS = new Set(['api.steampowered.com', 'www.ubisoft.com', 'www.youtube.com', 'www.googleapis.com', 'forum.gamer.com.tw', 'thedivision.fandom.com', 'api.anthropic.com']);

export const TIMEZONE = 'Asia/Tokyo';
export const STEAM_APP_ID = 2221490;

/** Stories older than this drop out of the edition (active glitches are kept). */
export const WINDOW_DAYS = 21;
/** Stories in one day's edition (raised from 40 on 2026-11-07: updates every 2 hours bring more). */
export const MAX_ITEMS = 60;
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
  bahamut: {
    name: '巴哈姆特 全境封鎖板',
    url: 'https://forum.gamer.com.tw/B.php?bsn=24460',
    authority: 15,
  },
} as const;
export type SourceId = keyof typeof SOURCES;

/** Steam feeds treated as official; other English feeds count as press ("reported"). */
export const STEAM_OFFICIAL_FEEDS = new Set(['steam_community_announcements']);

/** Classification rules, checked in order; first match wins. Matched against title + text. */
/** `zh` patterns cover Chinese titles (no \b word boundaries in CJK). */
export const CATEGORY_RULES: { category: Category; pattern: RegExp; zh?: RegExp }[] = [
  { category: 'franchise', pattern: /\b(resurgence|heartland|division 3|the division 3)\b/i, zh: /(復甦|重生|Resurgence|全境封鎖 ?3|全境3)/i },
  { category: 'glitch-watch', pattern: /\b(known issues?|exploit|glitch|bug report|workaround)\b/i, zh: /(漏洞|BUG|bug|卡關|已知問題|異常)/ },
  { category: 'updates', pattern: /\b(title update|TU ?Y\d+S\d+(\.\d+)?|patch notes?|hotfix|maintenance|PTS|server)\b/i, zh: /(更新|維護|Patch ?note|TU ?\d|Y\dS\d|PTS|開機|關機)/i },
  { category: 'community', pattern: /\b(twitch drops?|drops|creator collaboration|community|referral|giveaway)\b/i, zh: /(掉寶|Twitch|創作者|招募|抽獎)/i },
  { category: 'dark-zone', pattern: /\b(dark zone|pvp|conflict|rogue)\b/i, zh: /(暗區|衝突戰?|PvP|叛變)/i },
  { category: 'arsenal', pattern: /\b(exotic|named (weapon|item)|gear set|talent|brand set)\b/i, zh: /(奇特|具名|武器|裝備|天賦|套裝)/ },
  { category: 'builds', pattern: /\b(build|meta|tier list)\b/i, zh: /(配裝|流派|Build|build|BD|全汞|攻略)/ },
  { category: 'missions', pattern: /\b(dlc|expansion|season|mission|raid|manhunt|incursion|event|story|showcase)\b/i, zh: /(任務|劇情|突襲|活動|獵捕|DLC|懸賞|季節|賽季)/ },
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

export const CONFIDENCE_BASE = { official: 40, reported: 25, community: 22, rumour: 15 } as const;
