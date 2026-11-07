import type { ExpenseCategory, LedgerMonth, LedgerYear, YearRange } from '@/app/lib/definitions'
import { yearMonths } from './payments'

/** The building fund: the single definition of how its balance is computed. */
export function balance({
  openingBalanceAgorot,
  adjustmentsAgorot,
  paymentsAgorot,
  expensesAgorot,
}: {
  openingBalanceAgorot: number
  adjustmentsAgorot: number
  paymentsAgorot: number
  expensesAgorot: number
}): number {
  return openingBalanceAgorot + adjustmentsAgorot + paymentsAgorot - expensesAgorot
}

/**
 * The earliest date an expense may carry: the first day of the building's billing start month
 * (`YYYY-MM`). Spending before it is part of the opening balance. (Payments may go a year
 * earlier, for apartments paying ahead; expenses never do.)
 */
export function earliestSpentOn(billingStartMonth: string): string {
  return `${billingStartMonth}-01`
}

const yearOf = (date: string) => Number(date.slice(0, 4))

/**
 * The years `/money/balance` offers: from the earliest year the fund moved (billing start, or an
 * earlier payment paid ahead or correction) to this year. Nothing is dated in the future.
 */
export function ledgerYears(
  {
    billingStartMonth,
    earliestPaidOn,
    earliestAdjustedOn,
  }: {
    billingStartMonth: string
    /** `YYYY-MM-DD`, of the earliest payment that counts; null without one. */
    earliestPaidOn: string | null
    /** `YYYY-MM-DD` in the building's time zone, of the earliest correction; null without one. */
    earliestAdjustedOn: string | null
  },
  currentYear: number,
): YearRange {
  const starts = [billingStartMonth, earliestPaidOn, earliestAdjustedOn].flatMap((date) =>
    date === null ? [] : [yearOf(date)],
  )
  return { first: Math.min(...starts, currentYear), last: currentYear }
}

/** One sum of a year's money: payments and corrections by month, expenses by category too. */
export type LedgerRow =
  | { kind: 'payment' | 'adjustment'; category: null; month: string; amountAgorot: number }
  | { kind: 'expense'; category: ExpenseCategory; month: string; amountAgorot: number }

/**
 * A year of the fund from its sums: what came in (payments), went out (expenses, by category,
 * the largest first) and was corrected, and month by month up to this month. The months before
 * billing starts are left out while nothing happened in them.
 */
export function yearFigures(
  rows: LedgerRow[],
  {
    year,
    billingStartMonth,
    currentMonth,
  }: { year: number; billingStartMonth: string; currentMonth: string },
): Omit<LedgerYear, 'year' | 'years' | 'expenses'> {
  const byMonth = new Map<string, LedgerMonth>(
    yearMonths(year)
      .filter((month) => month <= currentMonth)
      .map((month) => [month, { month, incomeAgorot: 0, expensesAgorot: 0 }]),
  )
  const byCategory = new Map<ExpenseCategory, number>()
  let adjustmentsAgorot = 0

  for (const row of rows) {
    const month = byMonth.get(row.month)
    if (row.kind === 'payment') {
      if (month) month.incomeAgorot += row.amountAgorot
    } else if (row.kind === 'expense') {
      if (month) month.expensesAgorot += row.amountAgorot
      byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.amountAgorot)
    } else {
      adjustmentsAgorot += row.amountAgorot
    }
  }

  const months = [...byMonth.values()]
  const firstShown = months.findIndex(
    ({ month, incomeAgorot, expensesAgorot }) =>
      month >= billingStartMonth || incomeAgorot > 0 || expensesAgorot > 0,
  )
  const sumOf = (kind: LedgerRow['kind']) =>
    rows.reduce((sum, row) => (row.kind === kind ? sum + row.amountAgorot : sum), 0)

  return {
    incomeAgorot: sumOf('payment'),
    expensesAgorot: sumOf('expense'),
    adjustmentsAgorot,
    categories: [...byCategory]
      .map(([category, amountAgorot]) => ({ category, amountAgorot }))
      .toSorted((a, b) => b.amountAgorot - a.amountAgorot || a.category.localeCompare(b.category)),
    months: firstShown === -1 ? [] : months.slice(firstShown),
  }
}
