/**
 * The Back Page and other jokes. Rules (brief §6): game-world humour only, always labelled SATIRE,
 * never states game facts, written natively in each language (not translated line by line).
 * Everything is deterministic by date, so the same edition always tells the same jokes.
 */
import type { Locale } from '../i18n/index.ts';
import type { Edition, Patch } from '../schema/item.ts';

export type HumourLevel = 'light' | 'medium' | 'full';
export function humourLevel(): HumourLevel {
  const v = String(import.meta.env.HUMOUR_LEVEL ?? 'medium').toLowerCase();
  return v === 'light' || v === 'full' ? v : 'medium';
}

/** Small seeded random generator (mulberry32) so a date always picks the same jokes. */
export function seeded(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 3432918353) >>> 0;
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(list: readonly T[], rnd: () => number) => list[Math.floor(rnd() * list.length)]!;
function pickN<T>(list: readonly T[], n: number, rnd: () => number): T[] {
  const pool = [...list];
  const out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]!);
  return out;
}

type Bi = Record<Locale, readonly string[]>;

const TICKER: Bi = {
  en: [
    'I have analysed 4,312 posts. 4,311 were about loot.',
    "Reminder: 'one more run' is not a unit of time.",
    'ISAC confirms the Dark Zone is, in fact, still dark.',
    "Today's loot forecast: 90% gloves.",
    'All systems nominal. Your build, less so.',
    'Agents are reminded to hydrate between Climax runs.',
  ],
  'zh-hant': [
    '本系統已分析 4,312 篇貼文，其中 4,311 篇在討論掉寶。',
    '提醒：「再打一場」不是時間單位。',
    'ISAC 確認：暗區今天依然很暗。',
    '今日掉寶預報：九成是手套。',
    '系統狀態一切正常，你的配裝則不一定。',
    '打高潮任務之間，請記得補充水分。',
  ],
};

const CLASSIFIEDS: Bi = {
  en: [
    'WANTED: Agent who has not been killed by a Dark Zone rogue holding a pistol. Serious enquiries only.',
    "FOR SALE: 400 identical knee pads. All perfectly rolled for a stat I don't use.",
    "LOST: my sense of time. Last seen at the start of 'one quick mission'.",
    'ROOM TO LET: White House basement. Quiet, secure, excellent loot. Must tolerate ISAC.',
    'FREE: expert advice on Exotic drop rates. Accuracy not guaranteed. Or likely.',
    "SEEKING: the friend who said 'I'll only log on for twenty minutes'. Please come home.",
    'PERSONAL: [REDACTED] seeks [REDACTED] for long walks through [REDACTED].',
    'FOR HIRE: Field medic. Will revive you. Will also comment on your positioning.',
  ],
  'zh-hant': [
    '徵人：在暗區從沒被拿手槍的叛變特工撂倒過的特工。非誠勿擾。',
    '出售：護膝四百件，屬性全滿，可惜全滿在我用不到的那一項。',
    '遺失：時間感一枚。最後一次出現在「快速打一場任務」的開頭。',
    '分租：白宮地下室雅房。安靜、安全、物資充足，需能忍受 ISAC 碎念。',
    '免費諮詢：特異裝備掉落機率。準確度不保證，可能性也不保證。',
    '尋人：說「我只上線二十分鐘」的那位朋友，請速回家。',
    '機密徵友：［已塗黑］誠徵［已塗黑］，一同漫步於［已塗黑］。',
    '醫護兵求職：保證把你救起來，順便點評你的站位。',
  ],
};

/** Jokes that only run when today's paper has a matching story (by tag). */
const NEWS_CLASSIFIEDS: Record<string, Record<Locale, string>> = {
  crossplay: {
    en: 'FOR SALE: PC leaderboard rank, lightly used. Collection before November 10, for obvious reasons.',
    'zh-hant': '出售：PC 排行榜名次，八成新。請於 11 月 10 日前取貨，原因你懂的。',
  },
  dlc: {
    en: "MISSING: one Agent, last seen entering Central Park after dark. Answers to 'just one more run'.",
    'zh-hant': '尋人：特工一名，入夜後最後出現在中央公園。只要喊「再打一場就好」就會回頭。',
  },
  'known-issue': {
    en: 'SERVICES: Professional log-out-and-back-in technician. Fixes most known issues. Sometimes.',
    'zh-hant': '專業服務：資深「登出再登入」技師，已知問題大多能處理。偶爾。',
  },
  'twitch-drops': {
    en: 'WANTED: Someone to watch streams on my behalf so I get the drops. Payment in gloves.',
    'zh-hant': '徵人：代看直播領掉寶。酬勞以手套支付。',
  },
  'title-update': {
    en: "FREE TO A GOOD HOME: one build. Worked brilliantly until Tuesday's patch.",
    'zh-hant': '免費送養：配裝一套。在週二更新之前都表現優異。',
  },
};

const SIGNS: Bi = {
  en: ['Assault Rifle', 'SMG', 'LMG', 'Shotgun', 'Marksman Rifle', 'Pistol'],
  'zh-hant': ['步槍座', '衝鋒槍座', '輕機槍座', '霰彈槍座', '精準步槍座', '手槍座'],
};
const PREDICTIONS: Bi = {
  en: [
    'A named item approaches. It is the wrong one.',
    'Your next Exotic will be a duplicate, but a confident one.',
    'Avoid red containers before noon. After noon, avoid them anyway.',
    'A teammate will revive you at the least useful possible moment.',
    'Lucky stat: armor regen. Unlucky stat: everything else.',
    'The extraction chopper arrives on time. Trust no one holding the rope.',
    'Your build is perfect. The patch notes disagree.',
    'Gloves. Again. The stars have spoken.',
    'A god roll is coming — on the item you just dismantled.',
    'Vendor reset favours the bold. Also nobody.',
  ],
  'zh-hant': [
    '具名物品正朝你靠近，可惜不是你要的那件。',
    '下一件特異裝備會重複，但會重複得很有自信。',
    '中午前別碰紅色箱子，中午後也別碰。',
    '隊友會在最不需要的時候把你救起來。',
    '幸運屬性：護甲回復；不幸屬性：其餘全部。',
    '撤離直升機今天準時，但握著繩子的人別相信。',
    '你的配裝完美無缺——直到更新說明出現。',
    '手套，又是手套。星象已經表態。',
    '極品屬性即將出現，就在你剛拆掉的那件裝備上。',
    '商人重置對勇者有利，對其他人也沒什麼用。',
  ],
};

const LETTERS: Bi = {
  en: [
    'Dear Editor, I extracted a pair of gloves today. Someone cut the rope. Then someone cut me. Please advise. — Still Waiting at the Chopper',
    'To whoever went rogue with a pistol at the landmark: I respect it. I resent it. — Agent K.',
    'Dear Dispatch, is it normal to feel personally targeted by a drone? — Asking for a Skill-Build Friend',
    'Dear Editor, my clan has 100 slots now and I still have no friends. Is this a known issue? — Lonely in Georgetown',
  ],
  'zh-hant': [
    '編輯您好：今天撤離了一雙手套，結果有人割了繩子，接著又有人把我割了。請指教。——仍在直升機下等待的特工',
    '致在地標拿手槍叛變的那位：我尊敬你，我也記恨你。——特工 K',
    '快報您好：被無人機針對覺得受辱，這樣正常嗎？——替一位玩技能流的朋友發問',
    '編輯您好：戰隊上限都一百人了，我還是沒朋友。這算已知問題嗎？——喬治城的孤單特工',
  ],
};

const AGENT_OF_THE_DAY: Bi = {
  en: [
    'Commended for walking past a red container without checking it. Psychologists remain baffled.',
    'Commended for reading the patch notes before complaining about them.',
    'Commended for sharing the last ammo box. Twice.',
    'Commended for extracting with both the loot and the friendships intact.',
    'Commended for resisting the urge to shoot the first red barrel. For eleven whole seconds.',
  ],
  'zh-hant': [
    '表揚理由：經過紅色補給箱竟然沒有打開。心理專家至今百思不解。',
    '表揚理由：抱怨更新之前，先把更新說明看完了。',
    '表揚理由：最後一個彈藥箱讓給隊友，而且讓了兩次。',
    '表揚理由：成功撤離，戰利品和友情都完好無缺。',
    '表揚理由：忍住射爆第一個紅色油桶的衝動，整整十一秒。',
  ],
};

const FORECAST: Bi = {
  en: [
    'Morning: light ash. Afternoon: heavy gunfire. Evening: suspiciously quiet.',
    'Fog over the Potomac, with a 40% chance of Hunters.',
    'Clear skies, unclear motives. Wind from the Dark Zone, gusting rogue.',
    'Scattered drones, clearing by nightfall. UV index: Exotic.',
  ],
  'zh-hant': [
    '早上：微量落灰；下午：槍聲密集；晚上：安靜得可疑。',
    '波多馬克河上有霧，獵人出沒機率四成。',
    '天氣晴朗，動機不明。暗區方向吹來陣陣叛變風。',
    '零星無人機，入夜後轉晴。紫外線指數：特異級。',
  ],
};

export interface NerfOMeter {
  /** 0 = all numbers went down, 1 = all went up, null = no number changes. */
  needle: number | null;
  up: number;
  down: number;
  version?: string;
  verdict: string;
}

function nerfOMeter(locale: Locale, patch?: Patch): NerfOMeter {
  const up = patch?.changes.filter((c) => c.direction === 'up').length ?? 0;
  const down = patch?.changes.filter((c) => c.direction === 'down').length ?? 0;
  const total = up + down;
  const en = locale === 'en';
  const verdict = !total
    ? en ? 'Calm. Suspiciously calm.' : '風平浪靜，靜得可疑。'
    : !down
      ? en ? 'Numbers only went up. Enjoy it before Tuesday.' : '數字只升不降，趁週二前好好享受。'
      : !up
        ? en ? 'Nerf storm warning in effect.' : '削弱暴風警報生效中。'
        : en ? 'Partly cloudy with scattered nerfs.' : '多雲時晴，局部削弱。';
  return { needle: total ? up / total : null, up, down, version: patch?.version, verdict };
}

/** Scramble a word but never return it unchanged. */
function scramble(word: string, rnd: () => number): string {
  const chars = [...word.replace(/\s+/g, '')];
  for (let tries = 0; tries < 10; tries++) {
    const s = [...chars];
    for (let i = s.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [s[i], s[j]] = [s[j]!, s[i]!];
    }
    if (s.join('') !== chars.join('')) return s.join('');
  }
  return chars.reverse().join('');
}
const SCRAMBLE_WORDS: Bi = {
  en: ['DARKZONE', 'EXTRACTION', 'EXOTIC', 'CROSSPLAY', 'MANHUNT', 'AGENT', 'ROGUE'],
  'zh-hant': ['中央公園的迴響', '國土戰略局', '全境封鎖', '血月高照', '裝備專精'],
};

export interface BackPage {
  classifieds: string[];
  horoscope: { sign: string; text: string }[];
  letter: string;
  agent: string;
  forecast: string;
  nerf: NerfOMeter;
  scramble: { puzzle: string; answer: string };
}

export function backPage(locale: Locale, edition: Edition, latestPatch?: Patch, level = humourLevel()): BackPage {
  const rnd = seeded(`${edition.date}|${locale}`);
  const tags = new Set(edition.items.flatMap((i) => i.tags));
  const topical = Object.entries(NEWS_CLASSIFIEDS)
    .filter(([tag]) => tags.has(tag))
    .map(([, j]) => j[locale]);
  const n = level === 'full' ? 4 : level === 'light' ? 2 : 3;
  const classifieds = [...pickN(topical, Math.min(2, topical.length), rnd), ...pickN(CLASSIFIEDS[locale], n, rnd)].slice(0, n);
  const signs = SIGNS[locale];
  const preds = pickN(PREDICTIONS[locale], signs.length, rnd);
  const word = pick(SCRAMBLE_WORDS[locale], rnd);
  return {
    classifieds,
    horoscope: signs.map((sign, i) => ({ sign, text: preds[i % preds.length]! })),
    letter: pick(LETTERS[locale], rnd),
    agent: pick(AGENT_OF_THE_DAY[locale], rnd),
    forecast: pick(FORECAST[locale], rnd),
    nerf: nerfOMeter(locale, latestPatch),
    scramble: { puzzle: scramble(word, rnd), answer: word },
  };
}

/** Ticker tail jokes for the day (none at "light"). */
export function tickerJokes(locale: Locale, date: string, level = humourLevel()): string[] {
  if (level === 'light') return [];
  return pickN(TICKER[locale], level === 'full' ? 2 : 1, seeded(`ticker|${date}|${locale}`));
}

export function agentOfTheDay(locale: Locale, date: string): string {
  return pick(AGENT_OF_THE_DAY[locale], seeded(`${date}|${locale}`));
}
