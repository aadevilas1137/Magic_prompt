import preset from '@magic-prompt/tailwind-config';
import typography from '@tailwindcss/typography';

import type { Config } from 'tailwindcss';

const config: Config = {
  presets: [preset as Config],
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/features/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  plugins: [typography],
};

export default config;
