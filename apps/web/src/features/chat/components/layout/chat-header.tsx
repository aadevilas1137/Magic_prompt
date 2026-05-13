'use client';

import { Menu, Pencil, MoreHorizontal, Trash2, Archive } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import type { Chat } from '@magic-prompt/shared';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ArchiveChatDialog } from '@/features/chat/components/dialogs/archive-chat-dialog';
import { DeleteChatDialog } from '@/features/chat/components/dialogs/delete-chat-dialog';
import { RenameChatDialog } from '@/features/chat/components/dialogs/rename-chat-dialog';
import { useSidebarStore } from '@/features/chat/stores/sidebar-store';

interface ChatHeaderProps {
  readonly userId: string;
  readonly chat: Chat | null;
  readonly onChatRemoved?: ((chatId: string) => void) | (() => void);
}

/**
 * Sticky header inside the chat content area. Shows the chat title,
 * exposes the rename/delete/archive menu, and (on mobile) toggles the
 * sidebar drawer.
 */
export function ChatHeader({ userId, chat, onChatRemoved }: ChatHeaderProps) {
  const t = useTranslations('chat.actions');
  const toggleSidebar = useSidebarStore((s) => s.toggle);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <header className="bg-background flex h-12 items-center gap-2 border-b px-3 sm:px-4">
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
        className="hover:bg-accent inline-flex h-9 w-9 items-center justify-center rounded-md sm:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>
      <h1
        className="flex-1 truncate text-sm font-semibold tracking-tight"
        data-testid="chat-header-title"
      >
        {chat?.title ?? 'Magic Prompt AI'}
      </h1>
      {chat && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Chat actions"
              className="hover:bg-accent inline-flex h-9 w-9 items-center justify-center rounded-md"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setRenameOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              {t('rename.title')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setArchiveOpen(true)}>
              <Archive className="mr-2 h-4 w-4" />
              {t('archive.title')}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t('delete.title')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {chat && (
        <>
          <RenameChatDialog
            userId={userId}
            chatId={renameOpen ? chat.id : null}
            currentTitle={chat.title}
            onClose={() => setRenameOpen(false)}
          />
          <DeleteChatDialog
            userId={userId}
            chatId={deleteOpen ? chat.id : null}
            chatTitle={chat.title}
            onClose={() => setDeleteOpen(false)}
            {...(onChatRemoved && {
              onDeleted: (id: string) => (onChatRemoved as (id: string) => void)(id),
            })}
          />
          <ArchiveChatDialog
            userId={userId}
            chatId={archiveOpen ? chat.id : null}
            chatTitle={chat.title}
            onClose={() => setArchiveOpen(false)}
          />
        </>
      )}
    </header>
  );
}
