import { ErrorCode, HTTP_STATUS_BY_CODE } from './codes';

export interface AppErrorOptions {
  readonly code: ErrorCode;
  readonly message: string;
  readonly cause?: unknown;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly statusCode?: number;
}

/**
 * Domain error type used everywhere we throw.
 * Carries a stable code, an HTTP status, optional cause, and optional metadata.
 * Never throw raw strings; always throw an `AppError`.
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly metadata: Readonly<Record<string, unknown>> | undefined;

  public constructor(opts: AppErrorOptions) {
    super(opts.message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = 'AppError';
    this.code = opts.code;
    this.statusCode = opts.statusCode ?? HTTP_STATUS_BY_CODE[opts.code];
    this.metadata = opts.metadata;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      metadata: this.metadata,
    };
  }

  public static notImplemented(detail = 'Not implemented'): AppError {
    return new AppError({ code: ErrorCode.NOT_IMPLEMENTED, message: detail });
  }

  public static unauthorized(detail = 'Unauthorized'): AppError {
    return new AppError({ code: ErrorCode.UNAUTHORIZED, message: detail });
  }

  public static notFound(detail = 'Not found'): AppError {
    return new AppError({ code: ErrorCode.NOT_FOUND, message: detail });
  }

  public static validation(detail: string, metadata?: Readonly<Record<string, unknown>>): AppError {
    return new AppError(
      metadata !== undefined
        ? { code: ErrorCode.VALIDATION_ERROR, message: detail, metadata }
        : { code: ErrorCode.VALIDATION_ERROR, message: detail },
    );
  }

  public static internal(detail = 'Internal error', cause?: unknown): AppError {
    return new AppError(
      cause !== undefined
        ? { code: ErrorCode.INTERNAL_ERROR, message: detail, cause }
        : { code: ErrorCode.INTERNAL_ERROR, message: detail },
    );
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
