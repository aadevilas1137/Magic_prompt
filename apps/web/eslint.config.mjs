import nextConfig from '@magic-prompt/eslint-config/next';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...nextConfig,
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'coverage/**',
      'next-env.d.ts',
    ],
  },
];
