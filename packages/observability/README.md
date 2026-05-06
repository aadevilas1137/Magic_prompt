# `@magic-prompt/observability`

Sentry init wrapper for Next.js (client / server / edge runtimes).

## Usage

```ts
import { initSentry, captureException } from '@magic-prompt/observability';

initSentry(); // safe to call without DSN — no-op
captureException(err, { route: '/api/health' });
```

`initSentry()` is a silent no-op when `NEXT_PUBLIC_SENTRY_DSN` is missing — call it unconditionally at every Next.js entry point.

## Environment

| Variable                 | Notes                                   |
| ------------------------ | --------------------------------------- |
| `NEXT_PUBLIC_SENTRY_DSN` | Required to actually send events        |
| `SENTRY_AUTH_TOKEN`      | Build-time only, for source-map uploads |
