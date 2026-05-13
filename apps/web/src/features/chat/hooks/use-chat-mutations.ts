'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import type { ChatPage } from './use-chats';
import type { Chat } from '@magic-prompt/shared';

import {
  archiveChatAction,
  createChatAction,
  deleteChatAction,
  renameChatAction,
  unarchiveChatAction,
} from '@/features/chat/actions';
import { QUERY_KEYS } from '@/lib/constants';

/**
 * Helpers that operate on the cached infinite-query pages of chats.
 * Mutations call into these to keep optimistic updates straightforward.
 */
type ChatPages = { pages: ChatPage[]; pageParams: unknown[] };

function updatePages(
  data: ChatPages | undefined,
  updater: (chat: Chat) => Chat | null,
): ChatPages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      chats: page.chats.map((c) => updater(c)).filter((c): c is Chat => c !== null),
    })),
  };
}

export function useCreateChat(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title?: string } = {}) => {
      const state = await createChatAction(input);
      if (state.status === 'error') throw new Error(state.message);
      if (state.status === 'idle' || !state.chatId) throw new Error('Create returned no id');
      return state.chatId;
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.chats.all });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.chats.stats(userId) });
    },
  });
}

export function useDeleteChat(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (chatId: string) => {
      const state = await deleteChatAction({ chatId });
      if (state.status === 'error') throw new Error(state.message);
      return chatId;
    },
    onMutate: async (chatId) => {
      // Snapshot every list page so we can rollback on error.
      const listKey = QUERY_KEYS.chats.list({ userId });
      const archivedKey = QUERY_KEYS.chats.list({ userId, includeArchived: true });
      const prev: Array<[readonly unknown[], ChatPages | undefined]> = [];
      for (const key of [listKey, archivedKey]) {
        const data = qc.getQueryData<ChatPages>(key);
        prev.push([key, data]);
        qc.setQueryData<ChatPages>(key, (curr) =>
          updatePages(curr, (c) => (c.id === chatId ? null : c)),
        );
      }
      return { prev };
    },
    onError: (_err, _chatId, ctx) => {
      if (ctx?.prev) for (const [key, data] of ctx.prev) qc.setQueryData(key, data);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.chats.all });
    },
  });
}

export function useRenameChat(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { chatId: string; title: string }) => {
      const state = await renameChatAction(input);
      if (state.status === 'error') throw new Error(state.message);
      return input;
    },
    onMutate: async ({ chatId, title }) => {
      const listKey = QUERY_KEYS.chats.list({ userId });
      const prev = qc.getQueryData<ChatPages>(listKey);
      qc.setQueryData<ChatPages>(listKey, (curr) =>
        updatePages(curr, (c) => (c.id === chatId ? { ...c, title } : c)),
      );
      const detailKey = QUERY_KEYS.chats.detail(chatId);
      const prevDetail = qc.getQueryData<Chat>(detailKey);
      if (prevDetail) qc.setQueryData<Chat>(detailKey, { ...prevDetail, title });
      return { prev, prevDetail };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEYS.chats.list({ userId }), ctx.prev);
      if (ctx?.prevDetail) qc.setQueryData(QUERY_KEYS.chats.detail(vars.chatId), ctx.prevDetail);
    },
    onSettled: (_data, _err, vars) => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.chats.list({ userId }) });
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.chats.detail(vars.chatId) });
    },
  });
}

export function useArchiveChat(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ chatId, archived }: { chatId: string; archived: boolean }) => {
      const state = archived
        ? await archiveChatAction({ chatId })
        : await unarchiveChatAction({ chatId });
      if (state.status === 'error') throw new Error(state.message);
      return { chatId, archived };
    },
    onMutate: async ({ chatId, archived }) => {
      const listKey = QUERY_KEYS.chats.list({ userId });
      const archivedKey = QUERY_KEYS.chats.list({ userId, includeArchived: true });
      const prev: Array<[readonly unknown[], ChatPages | undefined]> = [];
      for (const key of [listKey, archivedKey]) {
        const data = qc.getQueryData<ChatPages>(key);
        prev.push([key, data]);
        qc.setQueryData<ChatPages>(key, (curr) =>
          updatePages(curr, (c) => {
            if (c.id !== chatId) return c;
            // If this is the active (non-archived) list and the chat just got archived,
            // remove it from view. The archived-list query will pick it up on re-fetch.
            if (archived && key === listKey) return null;
            return { ...c, isArchived: archived };
          }),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) for (const [key, data] of ctx.prev) qc.setQueryData(key, data);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: QUERY_KEYS.chats.all });
    },
  });
}
