import { z } from 'zod';

const optionalUrl = () =>
  z
    .string()
    .url()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : undefined));
const optionalString = () =>
  z
    .string()
    .min(1)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : undefined));

const EnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  NEXT_PUBLIC_SUPABASE_URL: optionalUrl(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString(),
  SUPABASE_SERVICE_ROLE_KEY: optionalString(),
  // Used at runtime by app code (server components, route handlers, server
  // actions). May be the Transaction pooler (port 6543) — fine for serverless.
  DATABASE_URL: optionalString(),
  // Used by drizzle-kit (migrations / schema introspection) only. Should be
  // the Session pooler or Direct connection (port 5432) so prepared statements
  // and DDL-in-transactions work. drizzle.config.ts falls back to DATABASE_URL
  // when this is unset.
  MIGRATE_DATABASE_URL: optionalString(),

  OPENAI_API_KEY: optionalString(),

  NEXT_PUBLIC_SENTRY_DSN: optionalUrl(),
  SENTRY_AUTH_TOKEN: optionalString(),

  NEXT_PUBLIC_POSTHOG_KEY: optionalString(),
  NEXT_PUBLIC_POSTHOG_HOST: optionalUrl(),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    '\n[env] Invalid environment configuration:\n',
    JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
  );
  throw new Error('Invalid environment configuration. See logs above.');
}

export const env = parsed.data;
export type Env = typeof env;

export const isSupabaseConfigured =
  Boolean(env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export const isDatabaseConfigured = Boolean(env.DATABASE_URL);
export const isSentryConfigured = Boolean(env.NEXT_PUBLIC_SENTRY_DSN);
export const isPostHogConfigured = Boolean(env.NEXT_PUBLIC_POSTHOG_KEY);
