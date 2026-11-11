// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Public address: used for canonical links, link previews and the sitemap.
  site: 'https://dc-dispatch.pages.dev',
  output: 'static',
  vite: {
    // Never inline small assets (e.g. tiny font subsets) as data: URLs — the CSP only allows fonts from 'self'.
    build: { assetsInlineLimit: 0 },
  },
  trailingSlash: 'always',
  i18n: {
    locales: ['en', 'zh-hant'],
    defaultLocale: 'en',
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
});
