/**
 * Traditional → Simplified character table for text that arrives in the browser after the page loads
 * (the live 今日戰鬥升級 list from /api/loot). Built once at build time from OpenCC, the same converter
 * scripts/simplify.ts uses for whole pages. Only characters that differ are listed (~20 KB).
 */
import * as OpenCC from 'opencc-js';

let table: Record<string, string> | undefined;

export function hansTable(): Record<string, string> {
  if (table) return table;
  const convert = OpenCC.Converter({ from: 'tw', to: 'cn' });
  table = {};
  for (let cp = 0x3400; cp <= 0x9fff; cp++) {
    const c = String.fromCodePoint(cp);
    const s = convert(c);
    if (s !== c && [...s].length === 1) table[c] = s;
  }
  return table;
}

/**
 * JSON with every non-ASCII character written as \uXXXX, so the page-wide conversion after the build
 * (which changes real characters only) leaves the table's Traditional keys alone.
 */
export const asciiJson = (value: unknown) => JSON.stringify(value).replace(/[\u0080-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
