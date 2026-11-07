import { describe, expect, it } from 'vitest'
import { yearMonths } from './payments'
import { balance, earliestSpentOn, ledgerYears, yearFigures, type LedgerRow } from './ledger'

describe('balance', () => {
  it.each([
    ['nothing yet', 0, 0, 0, 0, 0],
    ['opening only', 850_000, 0, 0, 0, 850_000],
    ['opening, payments and expenses', 850_000, 0, 420_000, 300_000, 970_000],
    ['a negative adjustment', 850_000, -50_000, 420_000, 300_000, 920_000],
    ['a positive adjustment', 0, 12_345, 0, 0, 12_345],
    ['expenses beyond the money in', 10_000, -5_000, 0, 20_000, -15_000],
  ])('%s', (_, openingBalanceAgorot, adjustmentsAgorot, paymentsAgorot, expensesAgorot, total) => {
    expect(
      balance({ openingBalanceAgorot, adjustmentsAgorot, paymentsAgorot, expensesAgorot }),
    ).toBe(total)
  })
})

describe('earliestSpentOn', () => {
  it.each([
    ['2025-11', '2025-11-01'],
    ['2026-01', '2026-01-01'],
  ])('billing from %s: an expense from %s on', (billingStartMonth, day) => {
    expect(earliestSpentOn(billingStartMonth)).toBe(day)
  })
})

describe('ledgerYears', () => {
  it.each([
    ['billing start only', { billingStartMonth: '2025-03' }, 2026, { first: 2025, last: 2026 }],
    [
      'a payment ahead of billing, the year before',
      { billingStartMonth: '2025-03', earliestPaidOn: '2024-11-20' },
      2026,
      { first: 2024, last: 2026 },
    ],
    [
      'an adjustment before billing starts',
      { billingStartMonth: '2025-03', earliestAdjustedOn: '2023-06-01' },
      2026,
      { first: 2023, last: 2026 },
    ],
    [
      'billing that starts next year: this year still shows',
      { billingStartMonth: '2027-01' },
      2026,
      { first: 2026, last: 2026 },
    ],
  ])('%s', (_, dates, currentYear, range) => {
    expect(
      ledgerYears({ earliestPaidOn: null, earliestAdjustedOn: null, ...dates }, currentYear),
    ).toEqual(range)
  })
})

describe('yearFigures', () => {
  const rows: LedgerRow[] = [
    { kind: 'payment', category: null, month: '2026-01', amountAgorot: 35_000 },
    { kind: 'payment', category: null, month: '2026-03', amountAgorot: 20_000 },
    { kind: 'expense', category: 'cleaning', month: '2026-01', amountAgorot: 12_000 },
    { kind: 'expense', category: 'cleaning', month: '2026-02', amountAgorot: 8_000 },
    { kind: 'expense', category: 'water', month: '2026-03', amountAgorot: 5_000 },
    { kind: 'expense', category: 'garden', month: '2026-03', amountAgorot: 5_000 },
    { kind: 'adjustment', category: null, month: '2026-01', amountAgorot: 7_000 },
    { kind: 'adjustment', category: null, month: '2026-02', amountAgorot: -2_000 },
  ]

  it('sums the money in, the money out and the corrections of the year', () => {
    const figures = yearFigures(rows, {
      year: 2026,
      billingStartMonth: '2025-03',
      currentMonth: '2026-04',
    })

    expect(figures).toMatchObject({
      incomeAgorot: 55_000,
      expensesAgorot: 30_000,
      adjustmentsAgorot: 5_000,
    })
  })

  it('totals each category, the largest first, equal ones by name', () => {
    const { categories } = yearFigures(rows, {
      year: 2026,
      billingStartMonth: '2025-03',
      currentMonth: '2026-04',
    })

    expect(categories).toEqual([
      { category: 'cleaning', amountAgorot: 20_000 },
      { category: 'garden', amountAgorot: 5_000 },
      { category: 'water', amountAgorot: 5_000 },
    ])
  })

  it('lists the months up to this one, with what came in and went out (no corrections)', () => {
    const { months } = yearFigures(rows, {
      year: 2026,
      billingStartMonth: '2025-03',
      currentMonth: '2026-04',
    })

    expect(months).toEqual([
      { month: '2026-01', incomeAgorot: 35_000, expensesAgorot: 12_000 },
      { month: '2026-02', incomeAgorot: 0, expensesAgorot: 8_000 },
      { month: '2026-03', incomeAgorot: 20_000, expensesAgorot: 10_000 },
      { month: '2026-04', incomeAgorot: 0, expensesAgorot: 0 },
    ])
  })

  it('lists every month of a past year', () => {
    const { months } = yearFigures([], {
      year: 2025,
      billingStartMonth: '2024-01',
      currentMonth: '2026-04',
    })

    expect(months.map(({ month }) => month)).toEqual(yearMonths(2025))
  })

  it('leaves out the quiet months before billing starts, but never a month with money', () => {
    const { months } = yearFigures(
      [{ kind: 'payment', category: null, month: '2025-02', amountAgorot: 35_000 }],
      { year: 2025, billingStartMonth: '2025-05', currentMonth: '2026-04' },
    )

    expect(months.map(({ month }) => month)).toEqual(yearMonths(2025).slice(1))
  })

  it('is all zeros, with no categories, for a year with nothing recorded', () => {
    expect(
      yearFigures([], { year: 2026, billingStartMonth: '2026-01', currentMonth: '2026-02' }),
    ).toEqual({
      incomeAgorot: 0,
      expensesAgorot: 0,
      adjustmentsAgorot: 0,
      categories: [],
      months: [
        { month: '2026-01', incomeAgorot: 0, expensesAgorot: 0 },
        { month: '2026-02', incomeAgorot: 0, expensesAgorot: 0 },
      ],
    })
  })
})
