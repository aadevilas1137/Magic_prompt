import { z } from 'zod';

/**
 * Email + password validation rules used across all auth forms.
 *
 * Constraints chosen for production safety:
 * - Email is lowercased + trimmed before validation so duplicate accounts
 *   like "User@Example.com" and "user@example.com" can't both exist.
 * - Password min 8 (NIST 800-63B SP recommendation), max 72 (bcrypt's hard
 *   limit — Supabase Auth uses bcrypt, longer values are silently truncated).
 * - Passwords must contain at least one letter AND one number to prevent
 *   trivially low-entropy passwords like "12345678" or "abcdefgh".
 */

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .email('Enter a valid email address');

export const PasswordSchema = z
  .string()
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX, `Password must be at most ${PASSWORD_MAX} characters`)
  .refine((v) => /[a-zA-Z]/.test(v), 'Password must contain at least one letter')
  .refine((v) => /\d/.test(v), 'Password must contain at least one number');

export const LoginSchema = z.object({
  email: EmailSchema,
  // For login we don't enforce strength rules — users existing accounts may
  // pre-date a strength bump. We only validate on signup / reset.
  password: z.string().min(1, 'Password is required'),
});

export const SignupSchema = z
  .object({
    email: EmailSchema,
    password: PasswordSchema,
    confirmPassword: z.string(),
    acceptedTos: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the Terms of Service' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const ForgotPasswordSchema = z.object({
  email: EmailSchema,
});

export const ResetPasswordSchema = z
  .object({
    password: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof LoginSchema>;
export type SignupInput = z.infer<typeof SignupSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const PASSWORD_LIMITS = {
  min: PASSWORD_MIN,
  max: PASSWORD_MAX,
} as const;
