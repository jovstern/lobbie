import { intlLocales } from '@/i18n/locale'
import type { Locale } from '@/i18n/routing'

/** The calendar date (`YYYY-MM-DD`) at `now` in the given IANA time zone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** Adds (or with a negative delta, subtracts) whole months to a `YYYY-MM` month. */
export function addMonths(month: string, delta: number): string {
  const [year, monthOfYear] = month.split('-').map(Number)
  const index = year * 12 + (monthOfYear - 1) + delta
  const nextYear = Math.floor(index / 12)
  const nextMonth = (index % 12) + 1
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`
}

/** The current month (`YYYY-MM`) at `now` in the given IANA time zone. */
export function currentMonthIn(timeZone: string, now: Date = new Date()): string {
  return todayIn(timeZone, now).slice(0, 7)
}

/** A `YYYY-MM` month as words in the locale ("November 2026", "נובמבר 2026"). */
export function formatMonth(month: string, locale: Locale): string {
  const [year, monthOfYear] = month.split('-').map(Number)
  // Formatted in UTC, the zone of the date built here, so no offset moves it into another month.
  return new Intl.DateTimeFormat(intlLocales[locale], {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthOfYear - 1, 1)))
}

/** The calendar date of an instant in the building's time zone, in the locale's words. */
export function formatDate(instant: Date, timeZone: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocales[locale], { dateStyle: 'medium', timeZone }).format(
    instant,
  )
}

/** A month as the app stores and sends it: `YYYY-MM`. */
export const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/
