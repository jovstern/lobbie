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
