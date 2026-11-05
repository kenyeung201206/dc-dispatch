import raw from '../../data/videos.json' with { type: 'json' };
import { VideoLibrarySchema, type Video } from '../schema/item.ts';
import type { Locale } from '../i18n/index.ts';
import { hasChinese, videoTitleZh } from './zh.ts';

const parsed = VideoLibrarySchema.safeParse(raw);
if (!parsed.success) throw new Error(`Invalid data/videos.json: ${parsed.error.message}`);

/** Verified videos, newest first. */
export const videos: Video[] = parsed.data.videos;

/** Videos for this language. Chinese readers get Chinese titles, and only videos that have one. */
export function videosFor(locale: Locale): Video[] {
  if (locale === 'en') return videos;
  const list = videos.flatMap((v) => {
    const titleZh = videoTitleZh(v);
    return titleZh ? [{ ...v, titleZh }] : [];
  });
  // Videos spoken in Chinese (Taiwan / Hong Kong / mainland creators, Ubisoft regional uploads) come first.
  const spokenZh = (v: Video) => Boolean(v.idZh) || hasChinese(v.title);
  return [...list.filter(spokenZh), ...list.filter((v) => !spokenZh(v))];
}

/** Video of the Day: the newest official video, else the newest of any. */
export function videoOfTheDay(locale: Locale): Video | undefined {
  const list = videosFor(locale);
  return list.find((v) => v.official) ?? list[0];
}

export const formatDuration = (s?: number) =>
  s ? `${Math.floor(s / 3600) ? `${Math.floor(s / 3600)}:` : ''}${String(Math.floor((s % 3600) / 60)).padStart(Math.floor(s / 3600) ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}` : '';
