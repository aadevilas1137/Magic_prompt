import * as Sentry from '@sentry/nextjs';

export interface SentryInitOptions {
  readonly dsn?: string;
  readonly environment?: string;
  readonly release?: string;
  readonly tracesSampleRate?: number;
  readonly enabled?: boolean;
}

let initialised = false;

/**
 * Initialise Sentry for the Next.js client/server/edge runtime.
 * Becomes a silent no-op when `dsn` is not provided — safe to call from any
 * environment without guarding the call site.
 */
export function initSentry(opts: SentryInitOptions = {}): void {
  if (initialised) return;

  const dsn = opts.dsn ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: opts.environment ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: opts.tracesSampleRate ?? 0.1,
    enabled: opts.enabled ?? true,
    ...(opts.release !== undefined ? { release: opts.release } : {}),
  });

  initialised = true;
}

export function captureException(
  error: unknown,
  context?: Readonly<Record<string, unknown>>,
): void {
  if (!initialised) return;
  Sentry.captureException(error, context ? { extra: { ...context } } : undefined);
}

export function captureMessage(message: string, context?: Readonly<Record<string, unknown>>): void {
  if (!initialised) return;
  Sentry.captureMessage(message, context ? { extra: { ...context } } : undefined);
}

export { Sentry };
