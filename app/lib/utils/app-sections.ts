import { localeInPath } from '@/i18n/locale'

// The signed-in app's top-level sections (spec §4), without the locale prefix. Every folder
// under app/[locale]/(app)/ must be listed (a test checks it). Everything else is public:
// sign-in, join, welcome, and unknown paths, which must stay 404s rather than sign-in
// redirects.
export const appSections = [
  '/money',
  '/schedule',
  '/building',
  '/meeting',
  '/more',
  '/profile',
  '/admin',
]

/** Whether a URL path (with or without a locale prefix) is a page of the signed-in app. */
export function isAppPage(pathname: string): boolean {
  const locale = localeInPath(pathname)
  const path = locale === null ? pathname : pathname.slice(locale.length + 1) || '/'
  return (
    path === '/' ||
    appSections.some((section) => path === section || path.startsWith(`${section}/`))
  )
}
