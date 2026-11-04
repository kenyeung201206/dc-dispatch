import { describe, expect, it } from 'vitest';
import sample from '../fixtures/edition-sample.json' with { type: 'json' };
import { EditionSchema, ItemSchema } from '../../src/schema/item.ts';

const item = sample.items[0]!;

describe('EditionSchema', () => {
  it('accepts the sample edition', () => {
    expect(EditionSchema.safeParse(sample).success).toBe(true);
  });

  it('rejects an empty edition', () => {
    expect(EditionSchema.safeParse({ ...sample, items: [] }).success).toBe(false);
  });
});

describe('ItemSchema', () => {
  it('requires a source URL', () => {
    const { sourceUrl: _, ...noSource } = item;
    expect(ItemSchema.safeParse(noSource).success).toBe(false);
  });

  it('rejects non-https source URLs', () => {
    expect(ItemSchema.safeParse({ ...item, sourceUrl: 'http://example.com/' }).success).toBe(false);
  });

  it('rejects summaries over 80 words', () => {
    const long = Array.from({ length: 81 }, () => 'word').join(' ');
    expect(ItemSchema.safeParse({ ...item, summary_en: long }).success).toBe(false);
  });

  it('allows an explicit "pending" Chinese summary but not an empty one', () => {
    expect(ItemSchema.safeParse({ ...item, summary_zhHant: 'pending' }).success).toBe(true);
    expect(ItemSchema.safeParse({ ...item, summary_zhHant: '' }).success).toBe(false);
  });

  it('rejects media without attribution', () => {
    const media = [
      {
        kind: 'image',
        url: 'https://example.com/a.webp',
        alt_en: 'a',
        alt_zhHant: '甲',
        license: 'CC-BY-4.0',
        attribution: '',
        attributionUrl: 'https://example.com/',
      },
    ];
    expect(ItemSchema.safeParse({ ...item, media }).success).toBe(false);
  });
});
