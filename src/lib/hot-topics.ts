import raw from '../../data/hot-topics.json' with { type: 'json' };
import { HotTopicsSchema } from '../schema/item.ts';

const parsed = HotTopicsSchema.safeParse(raw);
if (!parsed.success) throw new Error(`Invalid data/hot-topics.json: ${parsed.error.message}`);

/** 熱門討論 from 巴哈 (written by the robot each run; busiest first). */
export const hotTopics = parsed.data.topics;

/** UI key for a thread tag; unknown tags show as written. */
export const HOT_TAG_KEYS = { 問題: 'hot.tag.question', 討論: 'hot.tag.discussion', 閒聊: 'hot.tag.chat' } as const;

/** Title without its leading 【tag】, since the tag is shown as a chip. */
export const hotTitle = (title: string) => title.replace(/^【[^】]{1,4}】\s*/, '') || title;
