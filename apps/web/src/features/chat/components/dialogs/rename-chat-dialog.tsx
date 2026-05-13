'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRenameChat } from '@/features/chat/hooks';

interface RenameChatDialogProps {
  readonly userId: string;
  readonly chatId: string | null;
  readonly currentTitle: string;
  readonly onClose: () => void;
}

const MAX_LEN = 200;

export function RenameChatDialog({ userId, chatId, currentTitle, onClose }: RenameChatDialogProps) {
  const t = useTranslations('chat.actions.rename');
  const tErr = useTranslations('chat.errors');
  const mutation = useRenameChat(userId);
  const [title, setTitle] = useState(currentTitle);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (chatId) {
      setTitle(currentTitle);
      // Defer to next tick so the dialog has mounted and focus can land.
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [chatId, currentTitle]);

  const open = chatId !== null;
  const trimmed = title.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= MAX_LEN && trimmed !== currentTitle;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatId || !canSubmit) return;
    try {
      await mutation.mutateAsync({ chatId, title: trimmed });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tErr('generic'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription className="sr-only">
              Rename this chat — pick a short, memorable title.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="chat-rename">{t('label')}</Label>
            <Input
              ref={inputRef}
              id="chat-rename"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={MAX_LEN}
              disabled={mutation.isPending}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={mutation.isPending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={!canSubmit || mutation.isPending}>
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
