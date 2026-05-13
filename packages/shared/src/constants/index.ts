export const APP_NAME = 'Magic Prompt AI';
export const APP_TAGLINE = 'AI prompts, perfected.';
export const APP_DESCRIPTION =
  'Magic Prompt AI rewrites your raw input into a high-quality prompt and routes it to the best LLM for the job.';

/**
 * Domain taxonomy used by the IPE pipeline (Phase 4+).
 *
 * The 10 supported domains. Each maps to a template in
 * `@magic-prompt/ipe/src/templates/`. `GENERAL` is the fallback when the
 * classifier confidence is below threshold or no specialised template applies.
 *
 * Phase 6+ expands this list to 20+; keep the constant additive (don't
 * rename existing values — they appear verbatim in `prompt_logs.primary_domain`
 * and the LLM classifier prompt).
 */
export const Domain = {
  WEB_DEVELOPMENT: 'web_development',
  REAL_ESTATE: 'real_estate',
  CONTENT_WRITING: 'content_writing',
  MARKETING: 'marketing',
  DATA_ANALYSIS: 'data_analysis',
  EDUCATION: 'education',
  LEGAL: 'legal',
  HEALTHCARE: 'healthcare',
  HR: 'hr',
  GENERAL: 'general',
} as const;

export type Domain = (typeof Domain)[keyof typeof Domain];

export const ALL_DOMAINS: readonly Domain[] = Object.values(Domain);

/**
 * Complexity tier the IPE classifier assigns to every input. Drives prompt
 * verbosity and quality expectations downstream (Layer 3 + Layer 5).
 */
export const Complexity = {
  SIMPLE: 'simple',
  MODERATE: 'moderate',
  EXPERT: 'expert',
} as const;

export type Complexity = (typeof Complexity)[keyof typeof Complexity];

export const ALL_COMPLEXITIES: readonly Complexity[] = Object.values(Complexity);

export const DEFAULT_LOCALE = 'en';
export const SUPPORTED_LOCALES = ['en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
