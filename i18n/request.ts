import { notFound } from 'next/navigation'
import * as rootParams from 'next/root-params'
import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { routing } from '@/i18n/routing'

// The locale comes from the `[locale]` root segment, which keeps every page statically
// renderable under Cache Components without `setRequestLocale` (deprecated by next-intl).
export default getRequestConfig(async ({ locale: requested }) => {
  const candidate = requested ?? (await rootParams.locale())
  // A bad first segment (e.g. `/x.txt`, which the proxy skips) is a 404; in dev, Next then
  // logs "Could not validate `instant`" for that path, which is expected.
  if (!hasLocale(routing.locales, candidate)) notFound()

  return {
    locale: candidate,
    messages: (await import(`../messages/${candidate}.json`)).default,
  }
})
