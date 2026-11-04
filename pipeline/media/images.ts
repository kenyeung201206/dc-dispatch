import type { ImageAsset } from '../../src/schema/item.ts';

const LICENSE =
  'Official promotional image © Ubisoft Entertainment. Shown unmodified, with credit, on a private non-commercial site.';

export interface ImageLibrary {
  images: ImageAsset[];
  sectionBanners: Record<string, string>;
}

const baseUrl = (u: string) => u.split('?')[0]!;

/**
 * Return the id of the library image for this Ubisoft thumbnail, adding it if new.
 * Reuses an existing entry with the same file (e.g. hand-picked key art).
 */
export function ensureUbisoftImage(
  lib: ImageLibrary,
  imageUrl: string,
  opts: { articleId: string; title_en: string; title_zh?: string; articleUrl: string },
): string {
  const existing = lib.images.find((i) => baseUrl(i.url) === baseUrl(imageUrl));
  if (existing) return existing.id;
  const id = `ubi-${opts.articleId}`;
  const b = baseUrl(imageUrl);
  lib.images.push({
    id,
    kind: 'image',
    url: `${b}?w=1600`,
    width: 1600,
    height: 900,
    urlSmall: `${b}?w=640`,
    widthSmall: 640,
    alt_en: `Official image for "${opts.title_en}"`,
    alt_zhHant: opts.title_zh ? `官方新聞圖片：${opts.title_zh}` : `官方新聞圖片：${opts.title_en}`,
    tags: ['news'],
    license: LICENSE,
    attribution: 'Ubisoft',
    attributionUrl: opts.articleUrl,
    aiGenerated: false,
  });
  return id;
}
