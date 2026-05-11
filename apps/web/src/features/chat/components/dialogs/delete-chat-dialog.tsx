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
import { useDeleteChat } from '@/features/chat/hooks';

interface DeleteChatDialogProps {
  readonly userId: string;
  readonly chatId: string | null;
  readonly chatTitle: string | null;
  readonly onClose: () => void;
  readonly onDeleted?: (chatId: string) => void;
}

export function DeleteChatDialog({
  userId,
  chatId,
  chatTitle,
  onClose,
  onDeleted,
}: DeleteChatDialogProps) {
  const t = useTranslations('chat.actions.delete');
  const tErr = useTranslations('chat.errors');
  const mutation = useDeleteChat(userId);

  const open = chatId !== null;

  const handleConfirm = async () => {
    if (!chatId) return;
    try {
      await mutation.mutateAsync(chatId);
      onDeleted?.(chatId);
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
          <Button variant="destructive" onClick={handleConfirm} disabled={mutation.isPending}>
            {t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
