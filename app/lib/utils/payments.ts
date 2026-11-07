import type { ApartmentSummary, Arrears, YearRange } from '@/app/lib/definitions'
import { addMonths } from './dates'

/** How far ahead a payment may go: a building may be paid a year in advance. */
export const paymentMonthsAhead = 12

/**
 * The earliest date a payment may carry (`YYYY-MM-DD`): the first day of the month a year before
 * the apartment's billing starts. Mirrors the year ahead a payment may go: an apartment that
 * starts paying next month can pay in advance today, and a date far earlier is a typo.
 */
export function earliestPaidOn(billingStartMonth: string): string {
  return `${addMonths(billingStartMonth, -paymentMonthsAhead)}-01`
}

/** What remains owed for one month a payment is recorded for. */
type MonthOwed = { month: string; remainingAgorot: number }

export type PaymentSplit =
  | { ok: true; parts: { month: string; amountAgorot: number }[] }
  /** More than the months owe together; `owedAgorot` is what they owe. */
  | { ok: false; reason: 'tooMuch'; owedAgorot: number }
  /** Not enough to reach every month chosen; `month` is the first one left with nothing. */
  | { ok: false; reason: 'tooLittle'; month: string }

/**
 * Splits one amount over the months it pays, oldest first: each month gets what remains of it
 * until the amount runs out, so only the last month may be paid in part (spec §3). Never more
 * than the months owe (R15), and every month chosen gets something, since a payment row is
 * always above zero.
 */
export function splitPayment(amountAgorot: number, months: MonthOwed[]): PaymentSplit {
  const oldestFirst = months.toSorted((a, b) => a.month.localeCompare(b.month))
  const owedAgorot = oldestFirst.reduce((sum, month) => sum + month.remainingAgorot, 0)
  if (amountAgorot > owedAgorot) return { ok: false, reason: 'tooMuch', owedAgorot }

  let left = amountAgorot
  const parts: { month: string; amountAgorot: number }[] = []
  for (const { month, remainingAgorot } of oldestFirst) {
    if (left === 0) return { ok: false, reason: 'tooLittle', month }
    const part = Math.min(left, remainingAgorot)
    parts.push({ month, amountAgorot: part })
    left -= part
  }
  return { ok: true, parts }
}

/** The twelve months of a year, `YYYY-MM`, January first. */
export function yearMonths(year: number): string[] {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`)
}

const yearOf = (month: string) => Number(month.slice(0, 4))

/**
 * The years the payments grid offers: from the year the earliest billing starts (or the current
 * year, if billing starts later) to the year a payment ahead can reach.
 */
export function gridYears(firstBillingMonth: string, currentMonth: string): YearRange {
  return {
    first: Math.min(yearOf(firstBillingMonth), yearOf(currentMonth)),
    last: yearOf(addMonths(currentMonth, paymentMonthsAhead)),
  }
}

/**
 * The year `?year=` asks for, within `range`: the nearest year in it when outside, and the
 * current year when it is not a year at all.
 */
export function gridYear(
  param: string | string[] | undefined,
  range: YearRange,
  currentYear: number,
): number {
  if (typeof param !== 'string' || !/^[1-9]\d{3}$/.test(param)) return currentYear
  return Math.min(Math.max(Number(param), range.first), range.last)
}

/**
 * Who is behind (an earlier month not fully paid) and by how much, the largest debt first;
 * equal debts keep the order given. The total is what they owe together.
 */
export function arrearsOf(
  apartments: { id: string; number: string; summary: ApartmentSummary }[],
): Arrears {
  const behind = apartments
    .filter(({ summary }) => summary.monthsBehind > 0)
    .map(({ id, number, summary }) => ({
      id,
      number,
      monthsBehind: summary.monthsBehind,
      totalOwedAgorot: summary.totalOwedAgorot,
    }))
    .toSorted((a, b) => b.totalOwedAgorot - a.totalOwedAgorot)
  return {
    apartments: behind,
    totalOwedAgorot: behind.reduce((sum, apartment) => sum + apartment.totalOwedAgorot, 0),
  }
}
