// Writes dist/sitemap.xml (the page list Google reads) from the built pages. Runs at the end of `pnpm run build`.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

const SITE = 'https://dc-dispatch.pages.dev';
const DIST = 'dist';

/** Every built page's address, e.g. "/zh-hant/story/abc/". Pages marked noindex are left out. */
export async function pagePaths(dir = DIST): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || entry.name !== 'index.html') continue;
    const file = join(entry.parentPath, entry.name);
    if (/<meta name="robots" content="noindex/.test(await readFile(file, 'utf8'))) continue;
    const rel = relative(dir, entry.parentPath).split(sep).join('/');
    out.push(rel ? `/${rel}/` : '/');
  }
  return out.sort();
}

export function sitemapXml(paths: string[], site = SITE): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const urls = paths.map((p) => `  <url><loc>${esc(new URL(encodeURI(p), site).href)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

// Run directly (not imported by a test):
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const paths = await pagePaths();
  await writeFile(join(DIST, 'sitemap.xml'), sitemapXml(paths));
  console.log(`sitemap.xml: ${paths.length} pages`);
}
