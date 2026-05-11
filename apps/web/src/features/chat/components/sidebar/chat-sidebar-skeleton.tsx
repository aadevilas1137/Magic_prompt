import { Skeleton } from '@/components/ui/skeleton';

export function ChatSidebarSkeleton() {
  return (
    <div className="space-y-2 px-2 py-2" data-testid="chat-sidebar-skeleton">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}
