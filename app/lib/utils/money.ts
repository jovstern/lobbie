import { intlLocales } from '@/i18n/locale'
import type { Locale } from '@/i18n/routing'

const agorotPerShekel = 100
const maxAgorot = 10_000_000 * agorotPerShekel

/**
 * Formats agorot as shekels: whole amounts with no decimals (₪350), others with two (₪350.50).
 * `signed` also marks a positive amount (+₪350), for changes such as balance adjustments.
 */
export function formatAgorot(
  agorot: number,
  locale: Locale,
  { signed = false }: { signed?: boolean } = {},
): string {
  const fractionDigits = agorot % agorotPerShekel === 0 ? 0 : 2
  return new Intl.NumberFormat(intlLocales[locale], {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(agorot / agorotPerShekel)
}

// Digits with optional thousands commas (in groups of exactly three), then up to two decimals.
const shekelsPattern = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/

/**
 * Parses a shekel amount typed by a person into agorot, or null when it is not one.
 * Whole and fractional parts are read as integers, so the result never carries float error.
 */
export function parseShekelsToAgorot(input: string): number | null {
  const match = shekelsPattern.exec(input.trim())
  if (!match) return null
  const [, whole, fraction = ''] = match
  const agorot =
    Number(whole.replaceAll(',', '')) * agorotPerShekel + Number(fraction.padEnd(2, '0'))
  return agorot <= maxAgorot ? agorot : null
}
