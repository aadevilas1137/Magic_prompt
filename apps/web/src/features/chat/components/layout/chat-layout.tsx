'use client';

import { useEffect, type ReactNode } from 'react';

import type { Chat } from '@magic-prompt/shared';

import { ChatSidebar } from '@/features/chat/components/sidebar';
import { useActiveChatStore } from '@/features/chat/stores/active-chat-store';
import { useSidebarStore } from '@/features/chat/stores/sidebar-store';
import { useRouter } from '@/i18n/navigation';
import { chatRoute, ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface ChatLayoutProps {
  readonly userId: string;
  readonly activeChatId: string | null;
  readonly initialChats?: { chats: readonly Chat[]; nextCursor: string | null };
  readonly children: ReactNode;
}

/**
 * Two-column desktop / mobile-drawer chat shell.
 *
 * Desktop (≥sm): sidebar is always docked on the left, content fills the rest.
 * Mobile (<sm): sidebar slides in as an overlay drawer controlled by
 * `useSidebarStore`. The drawer auto-closes on chat selection and on every
 * route change (so navigating doesn't leave a hanging drawer).
 */
export function ChatLayout({ userId, activeChatId, initialChats, children }: ChatLayoutProps) {
  const router = useRouter();
  const setActive = useActiveChatStore((s) => s.setActiveChatId);
  const sidebarOpen = useSidebarStore((s) => s.isOpen);
  const closeSidebar = useSidebarStore((s) => s.close);

  // Sync active chat id from props (URL) into the client store so nested
  // components can read it via the store hook.
  useEffect(() => {
    setActive(activeChatId);
  }, [activeChatId, setActive]);

  // Close the mobile drawer whenever the active chat changes (the route just
  // changed) so the user lands on the chat, not on a still-open overlay.
  useEffect(() => {
    closeSidebar();
  }, [activeChatId, closeSidebar]);

  const handleSelect = (chatId: string) => {
    if (!chatId) {
      router.push(ROUTES.CHAT);
      return;
    }
    router.push(chatRoute(chatId));
  };

  return (
    <div className="bg-background flex min-h-0 w-full flex-1 overflow-hidden">
      {/* Mobile drawer backdrop */}
      <div
        aria-hidden
        onClick={closeSidebar}
        className={cn(
          'fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity sm:hidden',
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />
      {/* Sidebar (drawer on mobile, docked on desktop) */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-80 max-w-[85vw] transform transition-transform duration-200 sm:static sm:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0',
        )}
      >
        <ChatSidebar
          userId={userId}
          activeChatId={activeChatId}
          onSelect={handleSelect}
          onCreated={handleSelect}
          {...(initialChats && { initialChats })}
        />
      </div>

      {/* Main content column */}
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
