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
