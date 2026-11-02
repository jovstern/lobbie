import { NextResponse, type NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
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

export default function proxy(request: NextRequest) {
  return redirectToSavedLocale(request) ?? rememberLocale(request, handleI18nRouting(request))
}

export const config = {
  // Everything except API routes, Next and Vercel internals, and files (paths with a dot).
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
}
