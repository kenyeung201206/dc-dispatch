import raw from '../../data/visits.json' with { type: 'json' };
import { VisitsSchema, type Visits } from '../schema/item.ts';
import type { Locale } from '../i18n/index.ts';

const parsed = VisitsSchema.safeParse(raw);
if (!parsed.success) throw new Error(`Invalid data/visits.json: ${parsed.error.message}`);
const saved: Visits = parsed.data;

const tokyoToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

/** "1,234 次（今日 12）" from the saved counts, or null while there's nothing to show yet. */
export function visitsLine(locale: Locale, fmt: string, v: Visits = saved, today = tokyoToday()): string | null {
  const total = v.carriedOver + Object.values(v.days).reduce((a, b) => a + b, 0);
  if (!v.updatedAt && total === 0) return null;
  const n = (x: number) => x.toLocaleString(locale === 'en' ? 'en' : 'zh-Hant-TW');
  return fmt.replace('{total}', n(total)).replace('{today}', n(v.days[today] ?? 0));
}
