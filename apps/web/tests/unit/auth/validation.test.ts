import { describe, expect, it } from 'vitest';

import {
  EmailSchema,
  ForgotPasswordSchema,
  LoginSchema,
  PASSWORD_LIMITS,
  PasswordSchema,
  ResetPasswordSchema,
  SignupSchema,
} from '@/features/auth/lib/validation';

describe('EmailSchema', () => {
  it('accepts a valid email and lowercases + trims', () => {
    expect(EmailSchema.parse('  USER@Example.COM  ')).toBe('user@example.com');
  });

  it('rejects empty string', () => {
    expect(EmailSchema.safeParse('').success).toBe(false);
  });

  it('rejects malformed email', () => {
    expect(EmailSchema.safeParse('not-an-email').success).toBe(false);
    expect(EmailSchema.safeParse('user@').success).toBe(false);
    expect(EmailSchema.safeParse('@example.com').success).toBe(false);
  });
});

describe('PasswordSchema', () => {
  it('rejects passwords shorter than the min', () => {
    const result = PasswordSchema.safeParse('a1bcde');
    expect(result.success).toBe(false);
  });

  it('rejects passwords longer than the bcrypt cap', () => {
    const long = 'a1' + 'x'.repeat(PASSWORD_LIMITS.max + 1);
    const result = PasswordSchema.safeParse(long);
    expect(result.success).toBe(false);
  });

  it('rejects letters-only passwords', () => {
    expect(PasswordSchema.safeParse('abcdefghi').success).toBe(false);
  });

  it('rejects digits-only passwords', () => {
    expect(PasswordSchema.safeParse('123456789').success).toBe(false);
  });

  it('accepts a password with letter + digit at exactly the min length', () => {
    const password = 'a'.repeat(PASSWORD_LIMITS.min - 1) + '1';
    expect(PasswordSchema.safeParse(password).success).toBe(true);
  });
});

describe('LoginSchema', () => {
  it('accepts any non-empty password (no strength enforcement on login)', () => {
    const result = LoginSchema.safeParse({ email: 'a@b.com', password: 'x' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty password', () => {
    const result = LoginSchema.safeParse({ email: 'a@b.com', password: '' });
    expect(result.success).toBe(false);
  });
});

describe('SignupSchema', () => {
  const valid = {
    email: 'user@example.com',
    password: 'abcdef12',
    confirmPassword: 'abcdef12',
    acceptedTos: true as const,
  };

  it('accepts a valid signup payload', () => {
    expect(SignupSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects when passwords do not match', () => {
    const result = SignupSchema.safeParse({ ...valid, confirmPassword: 'different1' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toBeDefined();
    }
  });

  it('rejects when ToS is not accepted', () => {
    const result = SignupSchema.safeParse({ ...valid, acceptedTos: false });
    expect(result.success).toBe(false);
  });

  it('rejects when password fails strength rules', () => {
    const result = SignupSchema.safeParse({
      ...valid,
      password: 'tooshort',
      confirmPassword: 'tooshort',
    });
    expect(result.success).toBe(false);
  });
});

describe('ForgotPasswordSchema', () => {
  it('requires a valid email', () => {
    expect(ForgotPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
    expect(ForgotPasswordSchema.safeParse({ email: 'not-email' }).success).toBe(false);
  });
});

describe('ResetPasswordSchema', () => {
  it('accepts matching new passwords that satisfy strength rules', () => {
    const result = ResetPasswordSchema.safeParse({
      password: 'newpass1',
      confirmPassword: 'newpass1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-matching new passwords', () => {
    const result = ResetPasswordSchema.safeParse({
      password: 'newpass1',
      confirmPassword: 'different1',
    });
    expect(result.success).toBe(false);
  });
});
