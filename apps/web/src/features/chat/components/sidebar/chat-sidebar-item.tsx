'use client';

import { MoreHorizontal, Pencil, Trash2, Archive } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { Chat } from '@magic-prompt/shared';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface ChatSidebarItemProps {
  readonly chat: Chat;
  readonly isActive: boolean;
  readonly onSelect: (chatId: string) => void;
  readonly onRename: (chat: Chat) => void;
  readonly onDelete: (chat: Chat) => void;
  readonly onArchive: (chat: Chat) => void;
}

/**
 * Single chat row. The whole row is the navigation target; the inline
 * action menu lives on top with `event.stopPropagation()` so clicking the
 * trigger doesn't also select the chat.
 *
 * The action menu trigger fades in on hover (desktop) and is always visible
 * on touch (where there's no hover signal).
 */
export function ChatSidebarItem({
  chat,
  isActive,
  onSelect,
  onRename,
  onDelete,
  onArchive,
}: ChatSidebarItemProps) {
  const t = useTranslations('chat.actions');

  return (
    <div
      className={cn(
        'group relative flex h-9 items-center rounded-md text-sm',
        'transition-colors',
        isActive
          ? 'bg-accent text-accent-foreground'
          : 'text-foreground hover:bg-accent hover:text-accent-foreground',
      )}
      data-testid="chat-sidebar-item"
      data-active={isActive ? 'true' : 'false'}
    >
      <button
        type="button"
        onClick={() => onSelect(chat.id)}
        className="flex-1 truncate px-3 text-left text-sm focus-visible:outline-none"
        title={chat.title}
      >
        {chat.title}
      </button>
      <div className="opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 sm:opacity-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              aria-label="Open chat menu"
              className="hover:bg-accent text-muted-foreground hover:text-foreground inline-flex h-8 w-8 items-center justify-center rounded-md"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onRename(chat)}>
              <Pencil className="mr-2 h-4 w-4" />
              {t('rename.title')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onArchive(chat)}>
              <Archive className="mr-2 h-4 w-4" />
              {t('archive.title')}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(chat)}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t('delete.title')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
