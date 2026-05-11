'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useArchiveChat } from '@/features/chat/hooks';

interface ArchiveChatDialogProps {
  readonly userId: string;
  readonly chatId: string | null;
  readonly chatTitle: string | null;
  readonly onClose: () => void;
}

export function ArchiveChatDialog({ userId, chatId, chatTitle, onClose }: ArchiveChatDialogProps) {
  const t = useTranslations('chat.actions.archive');
  const tErr = useTranslations('chat.errors');
  const mutation = useArchiveChat(userId);

  const open = chatId !== null;

  const handleConfirm = async () => {
    if (!chatId) return;
    try {
      await mutation.mutateAsync({ chatId, archived: true });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tErr('generic'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description')}
            {chatTitle && (
              <span className="text-foreground mt-2 block truncate font-medium">{chatTitle}</span>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            {t('cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={mutation.isPending}>
            {t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
