import { describe, expect, it } from 'vitest';
import { bannerFor, imageFor, library } from '../../src/lib/images.ts';
import sample from '../fixtures/edition-sample.json' with { type: 'json' };
import { ItemSchema } from '../../src/schema/item.ts';

const item = ItemSchema.parse(sample.items[0]);

describe('image library', () => {
  it('every image has a credit, licence and https URLs', () => {
    for (const img of library.images) {
      expect(img.attribution, img.id).toBeTruthy();
      expect(img.license, img.id).toBeTruthy();
      expect(img.attributionUrl.startsWith('https://'), img.id).toBe(true);
      expect(img.alt_en && img.alt_zhHant, img.id).toBeTruthy();
    }
  });

  it('ids are unique', () => {
    const ids = library.images.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('imageFor', () => {
  it("uses the story's own image when it has one", () => {
    const p = imageFor({ ...item, imageId: 'ubi-echoes-keyart' }, new Set());
    expect(p).toMatchObject({ filePhoto: false, image: { id: 'ubi-echoes-keyart' } });
  });

  it('falls back to a labelled file photo that is not already used', () => {
    const used = new Set(['steam-0']);
    const p = imageFor(item, used);
    expect(p?.filePhoto).toBe(true);
    expect(p?.image.id).not.toBe('steam-0');
    expect(used.has(p!.image.id)).toBe(true);
  });

  it('never gives Franchise Desk stories a Division 2 file photo', () => {
    expect(imageFor({ ...item, category: 'franchise' }, new Set())).toBeNull();
  });

  it('skips a section banner already shown on the page', () => {
    const id = library.sectionBanners['updates']!;
    expect(bannerFor('updates', new Set([id]))).toBeNull();
  });
});
