export const locales = ['en'] as const;
export const defaultLocale = 'en';

export type Locale = (typeof locales)[number];

// Phase 2 will add 'hi'. The folder + config keep that addition cheap.
