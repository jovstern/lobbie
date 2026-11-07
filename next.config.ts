import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// Messages are compiled from ICU at build time, so the client ships a small formatter instead
// of the ICU parser (docs/adr/0002-next-intl-precompile.md). `t.raw` is unavailable with it.
const withNextIntl = createNextIntlPlugin({
  requestConfig: './i18n/request.ts',
  experimental: {
    messages: { path: './messages', format: 'json', locales: 'infer', precompile: true },
  },
})

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  experimental: {
    // Receipts of up to 4 MB arrive through a Server Action (R18), plus the multipart overhead;
    // the default limit is 1 MB. Vercel's own request limit is 4.5 MB.
    serverActions: { bodySizeLimit: '5mb' },
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
}

export default withNextIntl(nextConfig)
