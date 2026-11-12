import en from './en.json' with { type: 'json' };
import zhHant from './zh-hant.json' with { type: 'json' };

/**
 * Site languages. Traditional Chinese is the default. Simplified Chinese pages are built from the Traditional
 * text (same dictionary and data), then converted character by character after the build (scripts/simplify.ts).
 */
export const LOCALES = ['zh-hant', 'zh-hans', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'zh-hant';

/** BCP 47 tag for the `lang` attribute. */
export const HTML_LANG: Record<Locale, string> = {
  'zh-hant': 'zh-Hant-TW',
  'zh-hans': 'zh-Hans',
  en: 'en',
};

/** Name of each language, written in that language (for the language menu). */
export const LANG_NAME: Record<Locale, string> = { 'zh-hant': '繁體中文', 'zh-hans': '简体中文', en: 'English' };
/** Short label for the language button. */
export const LANG_SHORT: Record<Locale, string> = { 'zh-hant': '繁', 'zh-hans': '简', en: 'EN' };

export type UiKey = keyof typeof en;
const dictionaries: Record<Locale, Record<UiKey, string>> = { en, 'zh-hant': zhHant, 'zh-hans': zhHant };

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** Both Chinese versions read the same Chinese text. */
export const isZh = (locale: Locale) => locale !== 'en';
/** Which written text a page uses: 'en' or the (Traditional) Chinese source. */
export const textLocale = (locale: Locale): 'en' | 'zh-hant' => (locale === 'en' ? 'en' : 'zh-hant');

export function t(locale: Locale, key: UiKey): string {
  return dictionaries[locale][key];
}

/** t() with {placeholders}: tf('en', 'section.count', { n: 3 }) → "3 stories". */
export function tf(locale: Locale, key: UiKey, vars: Record<string, string | number>): string {
  return t(locale, key).replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

/** Same page in another language: /en/foo/ → /zh-hant/foo/ */
export function switchLocalePath(pathname: string, to: Locale): string {
  const parts = pathname.split('/');
  if (isLocale(parts[1])) parts[1] = to;
  else parts.splice(1, 0, to);
  return parts.join('/') || '/';
}

/** Dates are always shown in Taiwan / Hong Kong time (Asia/Taipei, UTC+8). */
export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(HTML_LANG[locale], {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date(iso));
}
