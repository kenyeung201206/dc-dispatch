import raw from '../../data/images.json' with { type: 'json' };
import { ImageLibrarySchema, type ImageAsset, type Item } from '../schema/item.ts';

const parsed = ImageLibrarySchema.safeParse(raw);
if (!parsed.success) throw new Error(`Invalid data/images.json: ${parsed.error.message}`);
export const library = parsed.data;

const byId = new Map(library.images.map((img) => [img.id, img]));
for (const [section, id] of Object.entries(library.sectionBanners)) {
  if (!byId.has(id)) throw new Error(`images.json: banner for "${section}" points to unknown image "${id}"`);
}

export function getImage(id: string): ImageAsset {
  const img = byId.get(id);
  if (!img) throw new Error(`Unknown image id "${id}"`);
  return img;
}

export interface PlacedImage {
  image: ImageAsset;
  /** True when the picture is a generic gameplay shot, not from this story ("File photo"). */
  filePhoto: boolean;
}

/** Stories outside The Division 2 never get a Division 2 file photo (it would mislead). */
const NO_FILE_PHOTO = new Set<Item['category']>(['franchise']);

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * Picture for a story: its own image if it has one, else an unused gameplay screenshot
 * picked deterministically and labelled as a file photo. `used` avoids repeats on a page.
 */
export function imageFor(item: Item, used: Set<string>): PlacedImage | null {
  if (item.imageId) {
    used.add(item.imageId);
    return { image: getImage(item.imageId), filePhoto: false };
  }
  if (NO_FILE_PHOTO.has(item.category)) return null;
  const shots = library.images.filter((i) => i.tags.includes('screenshot') && !used.has(i.id));
  if (!shots.length) return null;
  const pick = shots[hash(item.id) % shots.length]!;
  used.add(pick.id);
  return { image: pick, filePhoto: true };
}

/** Section banner, skipped if that picture already appears on the page. */
export function bannerFor(section: string, used: Set<string>): ImageAsset | null {
  const id = library.sectionBanners[section];
  if (!id || used.has(id)) return null;
  used.add(id);
  return getImage(id);
}
