import raw from '../../data/videos.json' with { type: 'json' };
import { VideoLibrarySchema, type Video } from '../schema/item.ts';

const parsed = VideoLibrarySchema.safeParse(raw);
if (!parsed.success) throw new Error(`Invalid data/videos.json: ${parsed.error.message}`);

/** Verified videos, newest first. */
export const videos: Video[] = parsed.data.videos;

/** Video of the Day: the newest official video, else the newest of any. */
export function videoOfTheDay(): Video | undefined {
  return videos.find((v) => v.official) ?? videos[0];
}

export const formatDuration = (s?: number) =>
  s ? `${Math.floor(s / 3600) ? `${Math.floor(s / 3600)}:` : ''}${String(Math.floor((s % 3600) / 60)).padStart(Math.floor(s / 3600) ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}` : '';
