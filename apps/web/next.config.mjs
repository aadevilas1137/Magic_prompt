import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    '@magic-prompt/analytics',
    '@magic-prompt/database',
    '@magic-prompt/ipe',
    '@magic-prompt/llm',
    '@magic-prompt/logger',
    '@magic-prompt/observability',
    '@magic-prompt/shared',
    '@magic-prompt/ui',
    '@magic-prompt/tailwind-config',
  ],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  eslint: {
    ignoreDuringBuilds: false,
    dirs: ['src'],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
