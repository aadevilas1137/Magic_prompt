import { AppError, ErrorCode, MessageRole } from '@magic-prompt/shared';
import { cn } from '@magic-prompt/ui';
import { describe, expect, it } from 'vitest';

describe('AppError', () => {
  it('produces the expected status for a known code', () => {
    const err = AppError.unauthorized('nope');
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe(ErrorCode.UNAUTHORIZED);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('nope');
  });

  it('round-trips through toJSON without losing fields', () => {
    const err = AppError.validation('bad', { field: 'email' });
    const json = err.toJSON() as Record<string, unknown>;
    expect(json['code']).toBe(ErrorCode.VALIDATION_ERROR);
    expect(json['statusCode']).toBe(400);
    expect(json['metadata']).toEqual({ field: 'email' });
  });
});

describe('cn (tailwind merge)', () => {
  it('merges conflicting utilities deterministically', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('drops falsy class values', () => {
    const flag: boolean = false;
    expect(cn('a', flag && 'b', undefined, null, 'c')).toBe('a c');
  });
});

describe('MessageRole', () => {
  it('exposes the three canonical roles', () => {
    expect(MessageRole.SYSTEM).toBe('system');
    expect(MessageRole.USER).toBe('user');
    expect(MessageRole.ASSISTANT).toBe('assistant');
  });
});
