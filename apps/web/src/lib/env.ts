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

  // --- OpenAI (required from Phase 3 onward — `/api/chat` won't function
  // without a valid key. Must start with `sk-` and be ≥20 chars; both classic
  // `sk-…` and project-scoped `sk-proj-…` keys match.)
  OPENAI_API_KEY: z.string().min(20).startsWith('sk-'),
  OPENAI_MODEL: z.string().min(1).default('gpt-4o'),
  OPENAI_TITLE_MODEL: z.string().min(1).default('gpt-4o-mini'),

  // --- Chat
  CHAT_CONTEXT_WINDOW: z.coerce.number().int().positive().max(100).default(20),
  CHAT_MAX_MESSAGE_LENGTH: z.coerce.number().int().positive().default(8000),

  // --- IPE (Phase 4 — Invisible Prompt Engine)
  // Master switch. When false, `/api/chat` behaves identically to Phase 3
  // (raw LLM, static system prompt). Defaults off for safe production rollout.
  IPE_ENABLED: z.coerce.boolean().default(false),
  // If IPE throws mid-pipeline, fall back to the Phase 3 raw-LLM path so the
  // user still gets a response. Turn off only when debugging.
  IPE_FALLBACK_ON_ERROR: z.coerce.boolean().default(true),
  // Per-layer timeouts. Layer 1 (intent) + Layer 2 (classifier) hit gpt-4o-mini;
  // 2s is generous for `gpt-4o-mini` (typically ~300-500ms). p-timeout aborts
  // and triggers fallback if exceeded.
  IPE_INTENT_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
  IPE_CLASSIFIER_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
  // Layer 5 sampling rate for LLM-as-judge quality scoring. 0.1 = 10% of
  // responses get a (sampled, async, gpt-4o-mini) judgment. The other 90%
  // rely on heuristic scoring only. Range 0-1; 0 disables LLM judge entirely.
  IPE_QUALITY_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),
  // Master switch for the `?showMagic=1` debug panel. Even with this on,
  // the page-level admin gate still applies. Defaults off for safety.
  IPE_DEBUG_MODE: z.coerce.boolean().default(false),
  // Pipeline schema version stamped on every `prompt_logs` row. Bump when the
  // pipeline architecture changes (e.g. add Layer 6, swap a template engine).
  IPE_PIPELINE_VERSION: z.string().min(1).default('v1'),
  // Comma-separated admin email list — gates `?showMagic=1`. Phase 8 RBAC will
  // replace this. Default includes the project owner so dev workflow doesn't
  // require setting a var locally. Empty string = no one (production hardening).
  IPE_ADMIN_EMAILS: z
    .string()
    .default('aadevilasrao1137@gmail.com')
    .transform((s) =>
      s
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0),
    ),

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
