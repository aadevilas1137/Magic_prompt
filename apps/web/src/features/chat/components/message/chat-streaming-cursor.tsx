/**
 * Blinking caret rendered at the tail of an in-progress assistant message.
 * Pure CSS animation (`animate-pulse` in tailwind) — no JS interval, no
 * jank during streaming.
 */
export function ChatStreamingCursor() {
  return (
    <span
      aria-hidden="true"
      data-testid="chat-streaming-cursor"
      className="bg-foreground ml-0.5 inline-block h-4 w-[2px] animate-pulse align-middle"
    />
  );
}
