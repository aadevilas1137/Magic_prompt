'use client';

import { Plus, MessageSquare, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { ChatSidebarEmpty } from './chat-sidebar-empty';
import { ChatSidebarGroup } from './chat-sidebar-group';
import { ChatSidebarItem } from './chat-sidebar-item';
import { ChatSidebarSkeleton } from './chat-sidebar-skeleton';

import type { Chat } from '@magic-prompt/shared';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArchiveChatDialog } from '@/features/chat/components/dialogs/archive-chat-dialog';
import { DeleteChatDialog } from '@/features/chat/components/dialogs/delete-chat-dialog';
import { RenameChatDialog } from '@/features/chat/components/dialogs/rename-chat-dialog';
import { useChats, useCreateChat } from '@/features/chat/hooks';
import { groupChatsByDate } from '@/features/chat/lib/group-chats-by-date';

interface ChatSidebarProps {
  readonly userId: string;
  readonly activeChatId: string | null;
  readonly onSelect: (chatId: string) => void;
  readonly onCreated: (chatId: string) => void;
  readonly initialChats?: { chats: readonly Chat[]; nextCursor: string | null };
}

/**
 * Two responsibilities:
 *   1. Lists the user's chats, grouped by date and pre-seeded from
 *      server-side rendering (no flash of loading).
 *   2. Owns the lifecycle of the three chat-mutation dialogs (rename,
 *      delete, archive) — they hang off the sidebar because that's where
 *      the actions are triggered.
 *
 * Phase 3 ships the search-input UI but the actual filter happens
 * client-side over already-loaded pages. Phase 6+ moves to server-side.
 */
export function ChatSidebar({
  userId,
  activeChatId,
  onSelect,
  onCreated,
  initialChats,
}: ChatSidebarProps) {
  const t = useTranslations('chat.sidebar');
  const tNew = useTranslations('chat');

  const query = useChats({ userId, ...(initialChats && { initialData: initialChats }) });
  const createChat = useCreateChat(userId);
  const [search, setSearch] = useState('');

  const [renameTarget, setRenameTarget] = useState<Chat | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Chat | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Chat | null>(null);

  const allChats = useMemo<readonly Chat[]>(
    () => query.data?.pages.flatMap((p) => p.chats) ?? [],
    [query.data],
  );
  const filteredChats = useMemo<readonly Chat[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allChats;
    return allChats.filter((c) => c.title.toLowerCase().includes(q));
  }, [allChats, search]);

  const groups = useMemo(() => groupChatsByDate(filteredChats, new Date()), [filteredChats]);

  const handleNewChat = async () => {
    try {
      const id = await createChat.mutateAsync({});
      onCreated(id);
    } catch {
      /* errors surface via Sonner upstream */
    }
  };

  return (
    <aside
      className="bg-background flex h-full w-full flex-col border-r sm:w-72"
      data-testid="chat-sidebar"
    >
      <div className="space-y-2 border-b p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-tight">{t('title')}</h2>
          <Button
            size="sm"
            onClick={handleNewChat}
            disabled={createChat.isPending}
            data-testid="new-chat-button"
          >
            <Plus className="mr-1 h-4 w-4" /> {tNew('newChat')}
          </Button>
        </div>
        <div className="relative">
          <Search className="text-muted-foreground absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search')}
            className="h-9 pl-8"
            aria-label={t('search')}
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {query.isLoading && <ChatSidebarSkeleton />}
        {!query.isLoading && filteredChats.length === 0 && (
          <ChatSidebarEmpty onNewChat={handleNewChat} />
        )}
        {!query.isLoading && filteredChats.length > 0 && (
          <div className="space-y-3 px-2 pb-3 pt-2">
            {groups.map((group) => (
              <ChatSidebarGroup key={group.id} id={group.id}>
                {group.chats.map((chat) => (
                  <ChatSidebarItem
                    key={chat.id}
                    chat={chat}
                    isActive={chat.id === activeChatId}
                    onSelect={onSelect}
                    onRename={setRenameTarget}
                    onDelete={setDeleteTarget}
                    onArchive={setArchiveTarget}
                  />
                ))}
              </ChatSidebarGroup>
            ))}
            {query.hasNextPage && (
              <button
                type="button"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
                className="text-muted-foreground hover:text-foreground mx-auto block py-2 text-xs"
              >
                <MessageSquare className="mr-1 inline h-3 w-3" /> Load more
              </button>
            )}
          </div>
        )}
      </ScrollArea>

      <RenameChatDialog
        userId={userId}
        chatId={renameTarget?.id ?? null}
        currentTitle={renameTarget?.title ?? ''}
        onClose={() => setRenameTarget(null)}
      />
      <DeleteChatDialog
        userId={userId}
        chatId={deleteTarget?.id ?? null}
        chatTitle={deleteTarget?.title ?? null}
        onClose={() => setDeleteTarget(null)}
        onDeleted={(deletedId) => {
          if (deletedId === activeChatId) onSelect('');
        }}
      />
      <ArchiveChatDialog
        userId={userId}
        chatId={archiveTarget?.id ?? null}
        chatTitle={archiveTarget?.title ?? null}
        onClose={() => setArchiveTarget(null)}
      />
    </aside>
  );
}
