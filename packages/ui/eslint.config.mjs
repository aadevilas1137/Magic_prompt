import reactConfig from '@magic-prompt/eslint-config/react';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...reactConfig,
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.turbo/**'],
  },
];
