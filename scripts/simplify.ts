// 简体中文: after `astro build`, converts every page under dist/zh-hans/ from Traditional to Simplified characters.
// The pages are built from the same Traditional text as /zh-hant/ (links, menus and language tags already point to
// zh-hans); this only changes the characters. Character-level conversion (OpenCC Taiwan → mainland forms), so
// names and terms stay the words we wrote, just in Simplified script. Runs in `pnpm run build`, before pagefind.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import * as OpenCC from 'opencc-js';

const DIR = 'dist/zh-hans';
const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });

/** Parts that must stay Traditional: the menu link back to 繁體中文 (its name and language tag). */
const KEEP = /<a\b[^>]*\bdata-lang-switch="zh-hant"[^>]*>[\s\S]*?<\/a>/g;

export function simplifyHtml(html: string): string {
  const kept: string[] = [];
  const marked = html.replace(KEEP, (m) => `\u0000${kept.push(m) - 1}\u0000`);
  const out = toSimplified(marked)
    // Language tags on the page's own text (not hreflang links to the Traditional pages).
    .replace(/(\s)lang="zh-Hant-TW"/g, '$1lang="zh-Hans"')
    .replace(/(\s)data-lang="zh-Hant-TW"/g, '$1data-lang="zh-Hans"');
  return out.replace(/\u0000(\d+)\u0000/g, (_, i: string) => kept[Number(i)]!);
}

export async function simplifyDir(dir = DIR): Promise<number> {
  let n = 0;
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.(html|json|xml|txt)$/.test(entry.name)) continue;
    const file = join(entry.parentPath, entry.name);
    const before = await readFile(file, 'utf8');
    const after = simplifyHtml(before);
    if (after !== before) await writeFile(file, after);
    n++;
  }
  return n;
}

// Run directly (not imported by a test):
if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  console.log(`简体中文: ${await simplifyDir()} files converted`);
}
