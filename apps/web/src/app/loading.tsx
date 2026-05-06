export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div
        role="status"
        aria-live="polite"
        className="border-muted border-t-foreground h-8 w-8 animate-spin rounded-full border-2"
      >
        <span className="sr-only">Loading…</span>
      </div>
    </div>
  );
}
