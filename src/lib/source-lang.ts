/** The language of a story's source (not of our translation): shown as 中文 / 英文 so readers know (owner, 2026-11-25). */
export function sourceLang(item: { lang_orig?: string }): 'zh' | 'en' | undefined {
  const l = (item.lang_orig ?? '').toLowerCase();
  if (l.startsWith('zh')) return 'zh';
  if (l.startsWith('en')) return 'en';
  return undefined;
}
