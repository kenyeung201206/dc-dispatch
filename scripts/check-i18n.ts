// Fails if the EN and zh-Hant UI dictionaries don't have exactly the same keys,
// or if any value is empty. Run: pnpm run i18n:check
import { readFileSync } from 'node:fs';

const load = (f: string): Record<string, string> =>
  JSON.parse(readFileSync(new URL(`../src/i18n/${f}`, import.meta.url), 'utf8'));

const dicts = { en: load('en.json'), 'zh-hant': load('zh-hant.json') };
const allKeys = new Set(Object.values(dicts).flatMap((d) => Object.keys(d)));
const problems: string[] = [];

for (const [lang, dict] of Object.entries(dicts)) {
  for (const key of allKeys) {
    if (!(key in dict)) problems.push(`${lang}: missing "${key}"`);
    else if (!dict[key]?.trim()) problems.push(`${lang}: empty "${key}"`);
  }
}

if (problems.length) {
  console.error(`i18n check failed:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`i18n check passed: ${allKeys.size} keys in ${Object.keys(dicts).length} locales.`);
