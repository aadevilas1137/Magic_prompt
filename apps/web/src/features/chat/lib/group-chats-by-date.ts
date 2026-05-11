import type { Chat } from '@magic-prompt/shared';

export type ChatGroupId = 'today' | 'yesterday' | 'thisWeek' | 'thisMonth' | 'older';

export interface ChatGroup {
  readonly id: ChatGroupId;
  readonly chats: readonly Chat[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Group a chat list by `lastMessageAt` into the five sidebar buckets.
 * Uses a fixed `now` argument so tests are deterministic; UI passes `new Date()`.
 *
 * Boundaries (in the local timezone of `now`):
 *   - today: same calendar date as `now`
 *   - yesterday: previous calendar date
 *   - thisWeek: within the last 7 days but earlier than yesterday
 *   - thisMonth: within the last 30 days but earlier than thisWeek
 *   - older: everything else
 */
export function groupChatsByDate(chats: readonly Chat[], now: Date): readonly ChatGroup[] {
  const buckets: Record<ChatGroupId, Chat[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    thisMonth: [],
    older: [],
  };

  const startOfToday = startOfDay(now);
  const startOfYesterday = startOfToday.getTime() - DAY_MS;
  const startOfWeek = startOfToday.getTime() - 7 * DAY_MS;
  const startOfMonth = startOfToday.getTime() - 30 * DAY_MS;

  for (const chat of chats) {
    const t = chat.lastMessageAt.getTime();
    if (t >= startOfToday.getTime()) {
      buckets.today.push(chat);
    } else if (t >= startOfYesterday) {
      buckets.yesterday.push(chat);
    } else if (t >= startOfWeek) {
      buckets.thisWeek.push(chat);
    } else if (t >= startOfMonth) {
      buckets.thisMonth.push(chat);
    } else {
      buckets.older.push(chat);
    }
  }

  return (['today', 'yesterday', 'thisWeek', 'thisMonth', 'older'] as const)
    .map((id) => ({ id, chats: buckets[id] }))
    .filter((g) => g.chats.length > 0);
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}
