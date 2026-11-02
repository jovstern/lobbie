import { defineRouting } from 'next-intl/routing'

// The language a person chose, kept for a year. The proxy reads it (see proxy.ts).
export const localeCookie = {
  name: 'NEXT_LOCALE',
  maxAge: 60 * 60 * 24 * 365,
  sameSite: 'lax',
} as const

export const routing = defineRouting({
  locales: ['he', 'en'],
  defaultLocale: 'he',
  // Hebrew lives at "/", English at "/en".
  localePrefix: 'as-needed',
  // Hebrew is the default whatever the browser's language; only a saved choice changes it.
  localeDetection: false,
  localeCookie,
})

export type Locale = (typeof routing.locales)[number]
