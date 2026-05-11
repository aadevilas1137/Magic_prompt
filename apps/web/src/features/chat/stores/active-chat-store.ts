'use client';

import { create } from 'zustand';

interface ActiveChatState {
  readonly activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
}

export const useActiveChatStore = create<ActiveChatState>((set) => ({
  activeChatId: null,
  setActiveChatId: (id) => set({ activeChatId: id }),
}));
