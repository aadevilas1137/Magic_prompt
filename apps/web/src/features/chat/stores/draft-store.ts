'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Per-chat draft persistence so users don't lose what they're typing when
 * they navigate between chats. Keyed by `chatId`; a special key `__new__`
 * holds the draft for `/chat/new` before a real id exists.
 *
 * Persisted to localStorage so drafts survive a page refresh too. Stripped
 * automatically when the chat is sent (the composer calls `clearDraft`).
 */
interface DraftState {
  readonly drafts: Readonly<Record<string, string>>;
  getDraft: (chatId: string) => string;
  setDraft: (chatId: string, value: string) => void;
  clearDraft: (chatId: string) => void;
}

export const NEW_CHAT_DRAFT_KEY = '__new__';

export const useDraftStore = create<DraftState>()(
  persist(
    (set, get) => ({
      drafts: {},
      getDraft: (chatId) => get().drafts[chatId] ?? '',
      setDraft: (chatId, value) =>
        set((state) => ({ drafts: { ...state.drafts, [chatId]: value } })),
      clearDraft: (chatId) =>
        set((state) => {
          if (!(chatId in state.drafts)) return state;
          const next = { ...state.drafts };
          delete next[chatId];
          return { drafts: next };
        }),
    }),
    {
      name: 'magic-prompt-drafts',
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);
