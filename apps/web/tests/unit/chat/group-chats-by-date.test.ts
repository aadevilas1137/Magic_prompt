import { describe, expect, it } from 'vitest';

import type { Chat } from '@magic-prompt/shared';

import { groupChatsByDate } from '@/features/chat/lib/group-chats-by-date';

const NOW = new Date('2026-05-15T12:00:00Z');

function mkChat(id: string, daysAgo: number, hoursAgo = 0): Chat {
  const t = new Date(NOW);
  t.setDate(t.getDate() - daysAgo);
  t.setHours(t.getHours() - hoursAgo);
  return {
    id,
    userId: 'u',
    title: id,
    summary: null,
    model: null,
    isArchived: false,
    lastMessageAt: t,
    createdAt: t,
    updatedAt: t,
  };
}

describe('groupChatsByDate', () => {
  it('returns empty array for empty input', () => {
    expect(groupChatsByDate([], NOW)).toEqual([]);
  });

  it('groups today, yesterday, this week, this month, older', () => {
    const chats = [
      mkChat('today-a', 0, 1),
      mkChat('today-b', 0, 5),
      mkChat('yesterday', 1, 1),
      mkChat('thisWeek', 3),
      mkChat('thisMonth', 15),
      mkChat('older', 90),
    ];
    const groups = groupChatsByDate(chats, NOW);
    const byId = Object.fromEntries(groups.map((g) => [g.id, g.chats.map((c) => c.id)]));
    expect(byId.today).toEqual(['today-a', 'today-b']);
    expect(byId.yesterday).toEqual(['yesterday']);
    expect(byId.thisWeek).toEqual(['thisWeek']);
    expect(byId.thisMonth).toEqual(['thisMonth']);
    expect(byId.older).toEqual(['older']);
  });

  it('omits empty buckets from output', () => {
    const onlyOlder = groupChatsByDate([mkChat('a', 100)], NOW);
    expect(onlyOlder.map((g) => g.id)).toEqual(['older']);
  });

  it('preserves order within a bucket (chats listed in input order)', () => {
    const a = mkChat('a', 0);
    const b = mkChat('b', 0);
    const groups = groupChatsByDate([a, b], NOW);
    expect(groups[0]?.chats.map((c) => c.id)).toEqual(['a', 'b']);
  });
});
