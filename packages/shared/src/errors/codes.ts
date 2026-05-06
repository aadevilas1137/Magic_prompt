/**
 * Canonical error codes used across the Magic Prompt AI platform.
 * Codes are stable contracts — never rename without a migration.
 */
export const ErrorCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  TIMEOUT: 'TIMEOUT',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const HTTP_STATUS_BY_CODE: Readonly<Record<ErrorCode, number>> = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.NOT_IMPLEMENTED]: 501,
  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCode.TIMEOUT]: 504,
};
