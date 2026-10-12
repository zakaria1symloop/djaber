import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// `NEXT_DIST_DIR=.next-dev` lets a development server run next to the production build served to the team (`.next`)
const config: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  transpilePackages: ['@djaber/ui'],
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true }, // lint runs as its own CI step
};

export default withNextIntl(config);
