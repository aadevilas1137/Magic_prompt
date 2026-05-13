import pino, { type Logger as PinoLogger, type LoggerOptions } from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

const REDACT_PATHS = [
  'password',
  'token',
  'apiKey',
  'authorization',
  'cookie',
  'secret',
  'creditCard',
  '*.password',
  '*.token',
  '*.apiKey',
  '*.authorization',
  '*.cookie',
  '*.secret',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
];

/**
 * `pino-pretty` opt-in. We *don't* enable it by default in dev anymore: Pino's
 * pretty transport spawns a worker thread via `thread-stream`, and Next.js 14
 * dev mode can't always trace the worker chunk through webpack — the result
 * is intermittent `Cannot find module '.next/server/vendor-chunks/lib/worker.js'`
 * crashes in route handlers that import the logger.
 *
 * If you want pretty terminal output during dev, pipe the JSON through
 * `pino-pretty` externally:
 *
 *   pnpm --filter @magic-prompt/web dev | pino-pretty
 *
 * Or set `LOGGER_PRETTY=true` to opt back in (e.g. for CLI scripts that
 * don't run inside Next).
 */
const wantPretty = process.env.LOGGER_PRETTY === 'true';

function buildOptions(): LoggerOptions {
  const base: LoggerOptions = {
    level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: { service: 'magic-prompt' },
  };

  if (wantPretty && !isProduction) {
    return {
      ...base,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname,service',
          singleLine: false,
        },
      },
    };
  }

  return base;
}

export const rootLogger: PinoLogger = pino(buildOptions());

export function createLogger(scope: string): PinoLogger {
  return rootLogger.child({ scope });
}

export type Logger = PinoLogger;
