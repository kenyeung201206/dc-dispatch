import raw from '../../data/exotics.json' with { type: 'json' };
import zhTypes from './exotic-types.json' with { type: 'json' };
import type { Locale } from '../i18n/index.ts';
import { ExoticLogSchema } from '../schema/item.ts';

const parsed = ExoticLogSchema.safeParse(raw);
if (!parsed.success) throw new Error(`Invalid data/exotics.json: ${parsed.error.message}`);

/** Newest first. */
export const exotics = parsed.data.exotics;

export function exoticType(type: string | undefined, locale: Locale): string | undefined {
  if (!type || locale === 'en') return type;
  return (zhTypes as Record<string, string>)[type] ?? type;
}
