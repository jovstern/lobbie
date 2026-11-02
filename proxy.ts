import { getSessionCookie } from 'better-auth/cookies'
import { NextRequest, NextResponse } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { isAppPage } from '@/app/lib/utils/app-sections'
import { requestPathHeader } from '@/app/lib/utils/redirect'
import { localeInPath } from '@/i18n/locale'
import { localeCookie, routing } from '@/i18n/routing'

const handleI18nRouting = createMiddleware(routing)

// Locale detection is off, so next-intl ignores the cookie: an unprefixed (Hebrew) URL
// sends someone who chose English to its `/en` version.
function redirectToSavedLocale(request: NextRequest): NextResponse | null {
  const { pathname, search } = request.nextUrl
  const saved = request.cookies.get(localeCookie.name)?.value
  if (request.method !== 'GET' || saved !== 'en' || localeInPath(pathname) !== null) return null
  const url = request.nextUrl.clone()
  url.pathname = pathname === '/' ? '/en' : `/en${pathname}`
  url.search = search
  return NextResponse.redirect(url)
}

// next-intl skips writing the cookie when it matches the browser's language, so opening
// `/en` in an English browser would not be remembered. Only page loads write it, as in
// next-intl, so background router requests never overwrite a fresh choice.
function rememberLocale(request: NextRequest, response: NextResponse): NextResponse {
  const isPageLoad = (request.headers.get('sec-fetch-dest') ?? 'document') === 'document'
  const locale = localeInPath(request.nextUrl.pathname) ?? routing.defaultLocale
  const saved = request.cookies.get(localeCookie.name)?.value
  if (isPageLoad && saved !== locale && !response.cookies.has(localeCookie.name)) {
    response.cookies.set({ ...localeCookie, value: locale, path: '/' })
  }
  return response
}

// Optimistic: a cookie that exists may still be expired, so pages check the session too
// (app/lib/authz.ts). This only saves a signed-out visitor a round trip.
function redirectToSignIn(request: NextRequest): NextResponse | null {
  const { pathname, search } = request.nextUrl
  if (!isAppPage(pathname) || getSessionCookie(request) !== null) return null
  const locale = localeInPath(pathname) ?? routing.defaultLocale
  const url = request.nextUrl.clone()
  url.pathname = locale === routing.defaultLocale ? '/sign-in' : `/${locale}/sign-in`
  url.search = `?${new URLSearchParams({ next: `${pathname}${search}` })}`
  return NextResponse.redirect(url)
}

// Pages read the requested path (for `?next=`) from this header; it is always overwritten, so
// a client cannot choose it.
function withRequestPath(request: NextRequest): NextRequest {
  const headers = new Headers(request.headers)
  headers.set(requestPathHeader, `${request.nextUrl.pathname}${request.nextUrl.search}`)
  return new NextRequest(request, { headers })
}

export default function proxy(request: NextRequest) {
  const savedLocale = redirectToSavedLocale(request)
  if (savedLocale) return savedLocale
  const response = handleI18nRouting(withRequestPath(request))
  // next-intl's own redirects (such as /he → /) come first; the target is checked next time.
  if (response.headers.has('location')) return rememberLocale(request, response)
  return rememberLocale(request, redirectToSignIn(request) ?? response)
}

export const config = {
  // Everything except API routes, Next and Vercel internals, and files (paths with a dot).
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
}
