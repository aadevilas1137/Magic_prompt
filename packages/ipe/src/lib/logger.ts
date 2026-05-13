import { createLogger } from '@magic-prompt/logger';

/**
 * IPE-scoped Pino child logger. Every log line is tagged with `scope: 'ipe'`
 * so production grep / log aggregators can isolate pipeline activity from
 * the rest of the app.
 *
 * **PII rules** — what we DO log:
 *   - userId (UUID)
 *   - chatId / messageId
 *   - layer name + latency
 *   - error messages
 *   - quality scores
 *   - domain / complexity classifications
 *
 * What we MUST NOT log:
 *   - The user's original message (the "lazy input") — Phase 4 spec §9
 *   - The constructed magic prompt — never leaves the server-side write to
 *     `prompt_logs`. Logging it would defeat the "invisible moat" property.
 *   - Any token or API key.
 *
 * The Pino redact list in `@magic-prompt/logger` already strips `apiKey`,
 * `token`, etc.; the additional discipline above is enforced by callsite review.
 */
export const ipeLogger = createLogger('ipe');
