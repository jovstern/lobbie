import { localeInPath } from '@/i18n/locale'
import { routing, type Locale } from '@/i18n/routing'

// C0 controls and DEL: browsers strip some of them, which can turn "/\t/evil" into "//evil".
const controlCharacter = /[\u0000-\u001f\u007f]/

function isSafeRelativePath(path: string): boolean {
  return (
    path.startsWith('/') && path[1] !== '/' && !path.includes('\\') && !controlCharacter.test(path)
  )
}

function decodeOnce(path: string): string | null {
  try {
    return decodeURIComponent(path)
  } catch {
    return null
  }
}

/**
 * Returns `input` when it is a path on this site (a single leading `/`), otherwise
 * `fallback`. Used for `?next=` and auth callback URLs so a link can never send someone
 * to another origin. The path is returned as given, so its locale prefix is kept.
 */
export function safeNextPath(input: unknown, fallback = '/'): string {
  if (typeof input !== 'string') return fallback
  const decoded = decodeOnce(input)
  if (decoded === null) return fallback
  return isSafeRelativePath(input) && isSafeRelativePath(decoded) ? input : fallback
}

/**
 * Adds `locale`'s prefix to a site path that has none (Hebrew, the default, has no prefix).
 * A path that already names a locale is kept, so a `next` path keeps the language it had.
 */
export function withLocalePrefix(path: string, locale: Locale): string {
  const pathname = path.split(/[?#]/, 1)[0]
  if (locale === routing.defaultLocale || localeInPath(pathname) !== null) return path
  return pathname === '/' ? `/${locale}${path.slice(1)}` : `/${locale}${path}`
}

/** The request header the proxy sets to the requested path and query, for `?next=`. */
export const requestPathHeader = 'x-request-path'

/**
 * Where a verified sign-in lands, in the language saved to the profile: an unprefixed (Hebrew)
 * callback gains the saved locale's prefix; one that already names a locale keeps it, since
 * the person chose it on that page. Returns the absolute URL and the locale it is in, for the
 * locale cookie, so the proxy does not reset it on arrival.
 */
export function localizedLanding(
  location: string,
  base: string,
  savedLocale: unknown,
): { url: string; locale: Locale } {
  const url = new URL(location, base)
  const saved = routing.locales.find((locale) => locale === savedLocale) ?? routing.defaultLocale
  const path = withLocalePrefix(`${url.pathname}${url.search}${url.hash}`, saved)
  const landing = new URL(path, url)
  return {
    url: landing.toString(),
    locale: localeInPath(landing.pathname) ?? routing.defaultLocale,
  }
}
