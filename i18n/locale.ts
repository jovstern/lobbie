import { routing, type Locale } from '@/i18n/routing'

/** The Intl locale for each app locale: Israeli conventions (dates, ₪) in both languages. */
export const intlLocales = { he: 'he-IL', en: 'en-IL' } as const satisfies Record<Locale, string>

const rightToLeft: ReadonlySet<Locale> = new Set(['he'])

export function dirFor(locale: Locale): 'rtl' | 'ltr' {
  return rightToLeft.has(locale) ? 'rtl' : 'ltr'
}

function isLocale(value: string): value is Locale {
  return routing.locales.some((locale) => locale === value)
}

/** The locale a URL path names by its first segment, or `null` for an unprefixed path. */
export function localeInPath(pathname: string): Locale | null {
  const firstSegment = pathname.split('/')[1] ?? ''
  return isLocale(firstSegment) ? firstSegment : null
}
