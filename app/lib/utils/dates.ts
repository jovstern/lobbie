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
