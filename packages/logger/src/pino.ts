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

  if (!isProduction) {
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
