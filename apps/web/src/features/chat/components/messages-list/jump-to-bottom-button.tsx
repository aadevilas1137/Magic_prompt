import { ArrowDown } from 'lucide-react';

import { cn } from '@/lib/utils';

interface JumpToBottomButtonProps {
  readonly visible: boolean;
  readonly onClick: () => void;
}

/**
 * Floating "scroll to latest" button. Visible only when the user has
 * scrolled away from the bottom. Tap target is ≥44px square per mobile a11y.
 */
export function JumpToBottomButton({ visible, onClick }: JumpToBottomButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Jump to latest message"
      data-testid="jump-to-bottom"
      className={cn(
        'pointer-events-auto absolute bottom-4 left-1/2 z-10 -translate-x-1/2',
        'border-border bg-background/90 hover:bg-background text-foreground inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-md backdrop-blur transition',
        'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <ArrowDown className="h-4 w-4" aria-hidden />
    </button>
  );
}
