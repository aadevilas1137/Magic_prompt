'use client';

import { create } from 'zustand';

interface SidebarState {
  readonly isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

/**
 * Controls the mobile sidebar drawer. Desktop sidebar is always rendered;
 * mobile uses this as the open/closed switch.
 */
export const useSidebarStore = create<SidebarState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));
