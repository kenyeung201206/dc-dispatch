import rawGuides from '../../data/guides.json' with { type: 'json' };
import rawEvents from '../../data/events.json' with { type: 'json' };
import { GameEventLogSchema, GuideLogSchema, type Guide, type Video } from '../schema/item.ts';

const g = GuideLogSchema.safeParse(rawGuides);
if (!g.success) throw new Error(`Invalid data/guides.json: ${g.error.message}`);
const e = GameEventLogSchema.safeParse(rawEvents);
if (!e.success) throw new Error(`Invalid data/events.json: ${e.error.message}`);

export const events = e.data.events;

const tokyoToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

/** Guides still running on the day the site is built (the daily rebuild removes expired ones). */
export const guides: Guide[] = g.data.guides.filter((x) => x.until >= tokyoToday());

export const eventFor = (gd: Guide) => (gd.eventId ? events.find((ev) => ev.id === gd.eventId) : undefined);

/** Shape a video guide for the VideoFacade player. */
export const guideVideo = (gd: Guide): Video => ({
  id: gd.videoId!,
  title: gd.title,
  channelName: gd.channelName,
  channelUrl: gd.channelUrl,
  publishedAt: gd.publishedAt,
  official: false,
  row: 'build-guides',
  rumour: false,
  checkedAt: gd.checkedAt ?? gd.publishedAt,
  via: 'youtube-api',
});
