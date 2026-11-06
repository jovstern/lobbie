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

// The path without its locale prefix.
function unprefixed(pathname: string): string {
  const locale = localeInPath(pathname)
  return locale === null ? pathname : pathname.slice(locale.length + 1) || '/'
}

/** Whether a URL path (with or without a locale prefix) is a page of the signed-in app. */
export function isAppPage(pathname: string): boolean {
  const path = unprefixed(pathname)
  return (
    path === '/' ||
    appSections.some((section) => path === section || path.startsWith(`${section}/`))
  )
}

/** Whether a URL path is `/join` or an invite under it, whose code is a secret in the URL. */
export function isJoinPage(pathname: string): boolean {
  const path = unprefixed(pathname)
  return path === '/join' || path.startsWith('/join/')
}

/**
 * Whether a page's URL may hold an invite code: a join page, or sign-in on its way back to one
 * (`?next=/join/<code>`). The code also travels in the magic link's callback, which goes to
 * the same person's inbox; that is accepted.
 */
export function carriesInviteCode(url: URL): boolean {
  if (isJoinPage(url.pathname)) return true
  const next = url.searchParams.get('next')
  return unprefixed(url.pathname) === '/sign-in' && next !== null && isJoinPage(next)
}
