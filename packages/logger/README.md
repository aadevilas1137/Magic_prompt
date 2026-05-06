# `@magic-prompt/logger`

Structured logging via [Pino](https://getpino.io). Pretty-printed in dev, JSON in prod, with sensitive fields auto-redacted.

## Usage

```ts
import { createLogger } from '@magic-prompt/logger';

const log = createLogger('chat:api');

log.info({ userId }, 'received message');
log.error({ err }, 'failed to persist');
```

## Redaction

The following paths are auto-redacted to `[REDACTED]` in every log line: `password`, `token`, `apiKey`, `authorization`, `cookie`, `secret`, `creditCard`, plus `req.headers.authorization`, `req.headers.cookie`, and `res.headers["set-cookie"]`.

Never `console.log`. Always `createLogger(scope)`.

## Environment

| Variable    | Default                 | Notes                                                |
| ----------- | ----------------------- | ---------------------------------------------------- |
| `LOG_LEVEL` | `info` (prod) / `debug` | One of `trace`/`debug`/`info`/`warn`/`error`/`fatal` |
| `NODE_ENV`  | —                       | `production` swaps to JSON output                    |
