import nextPlugin from '@next/eslint-plugin-next';

import reactConfig from './react.js';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...reactConfig,
  {
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // App Router only — and `no-duplicate-head` in @next/eslint-plugin-next@14
      // calls `context.getAncestors()`, removed in ESLint 9. Re-enable once the
      // plugin ships an ESLint-9-compatible release.
      '@next/next/no-duplicate-head': 'off',
    },
  },
];
