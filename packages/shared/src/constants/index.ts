export const APP_NAME = 'Magic Prompt AI';
export const APP_TAGLINE = 'AI prompts, perfected.';
export const APP_DESCRIPTION =
  'Magic Prompt AI rewrites your raw input into a high-quality prompt and routes it to the best LLM for the job.';

/**
 * Domain taxonomy used by the IPE pipeline (Phase 4+).
 * Listed here as the canonical source of truth.
 */
export const Domain = {
  GENERAL: 'general',
  CODE: 'code',
  WRITING: 'writing',
  ANALYSIS: 'analysis',
  CREATIVE: 'creative',
  RESEARCH: 'research',
  EDUCATION: 'education',
  BUSINESS: 'business',
} as const;

export type Domain = (typeof Domain)[keyof typeof Domain];

export const DEFAULT_LOCALE = 'en';
export const SUPPORTED_LOCALES = ['en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
