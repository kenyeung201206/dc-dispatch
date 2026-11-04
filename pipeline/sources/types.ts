import type { SourceId } from '../config.ts';

/** What every source module returns, before normalising into edition items. */
export interface RawItem {
  sourceId: SourceId;
  sourceName: string;
  /** Source's own id (Steam gid, Ubisoft content id). */
  externalId: string;
  url: string;
  title: string;
  /** Plain text body (markup stripped). */
  text: string;
  /** Original markdown/BBCode body, used only for structured parsing (known issues). */
  rawBody: string;
  /** Publisher-written short description, if any. */
  abstract?: string;
  publishedAt: string;
  lang: 'en' | 'zh';
  confidence: 'official' | 'reported';
  imageUrl?: string;
}

export interface SourceResult {
  sourceId: SourceId;
  ok: boolean;
  items: RawItem[];
  note?: string;
  /** Raw response body, kept in memory only (used to read videos from the same page). */
  body?: string;
}
