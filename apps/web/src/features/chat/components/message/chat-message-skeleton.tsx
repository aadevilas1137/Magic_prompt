import { Skeleton } from '@/components/ui/skeleton';

/**
 * Three-line skeleton used while messages load. Approximates the height
 * of a real assistant message so the layout doesn't jump on hydration.
 */
export function ChatMessageSkeleton() {
  return (
    <div data-testid="chat-message-skeleton" className="space-y-2 px-3 py-3 sm:px-4">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}
