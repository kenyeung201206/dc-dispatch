import type { Locale } from '../i18n/index.ts';
import type { Category } from '../schema/item.ts';

/** All internal URLs in one place (trailing slashes match astro.config trailingSlash: 'always'). */
export const routes = {
  home: (l: Locale) => `/${l}/`,
  story: (l: Locale, id: string) => `/${l}/story/${id}/`,
  section: (l: Locale, c: Category) =>
    c === 'front-page' ? `/${l}/` : c === 'watch-now' ? `/${l}/watch/` : `/${l}/section/${c}/`,
  watch: (l: Locale) => `/${l}/watch/`,
  archive: (l: Locale) => `/${l}/archive/`,
  edition: (l: Locale, date: string) => `/${l}/edition/${date}/`,
  patches: (l: Locale) => `/${l}/patches/`,
  search: (l: Locale) => `/${l}/search/`,
};
