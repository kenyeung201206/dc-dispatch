import raw from '../../data/patches.json' with { type: 'json' };
import { PatchLogSchema } from '../schema/item.ts';

const parsed = PatchLogSchema.safeParse(raw);
if (!parsed.success) throw new Error(`Invalid data/patches.json: ${parsed.error.message}`);

/** Title updates, newest first. */
export const patches = parsed.data.patches;
