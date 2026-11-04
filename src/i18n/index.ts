import en from './en.json' with { type: 'json' };
import zhHant from './zh-hant.json' with { type: 'json' };

export const LOCALES = ['en', 'zh-hant'] as const;
export type Locale = (typeof LOCALES)[number];

/** BCP 47 tag for the `lang` attribute. */
export const HTML_LANG: Record<Locale, string> = {
  en: 'en',
  'zh-hant': 'zh-Hant-TW',
};

export type UiKey = keyof typeof en;
const dictionaries: Record<Locale, Record<UiKey, string>> = { en, 'zh-hant': zhHant };

export function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function t(locale: Locale, key: UiKey): string {
  return dictionaries[locale][key];
}

/** t() with {placeholders}: tf('en', 'section.count', { n: 3 }) → "3 stories". */
export function tf(locale: Locale, key: UiKey, vars: Record<string, string | number>): string {
  return t(locale, key).replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'en' ? 'zh-hant' : 'en';
}

/** Same page in the other language: /en/foo/ → /zh-hant/foo/ */
export function switchLocalePath(pathname: string, to: Locale): string {
  const parts = pathname.split('/');
  if (isLocale(parts[1])) parts[1] = to;
  else parts.splice(1, 0, to);
  return parts.join('/') || '/';
}

/** Dates are always shown in Asia/Tokyo. */
export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(HTML_LANG[locale], {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date(iso));
}
