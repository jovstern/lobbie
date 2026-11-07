import { describe, expect, it } from 'vitest'
import type { FeeRate, MonthPayment } from '@/app/lib/definitions'
import { currentMonthIn } from './dates'
import {
  apartmentStanding,
  apartmentSummary,
  monthStatus,
  openMonths,
  residentMonths,
  type ApartmentBilling,
} from './status'

const apartmentId = 'apt-1'
const fee = 35_000

const billing = (overrides: Partial<ApartmentBilling> = {}): ApartmentBilling => ({
  apartment: { id: apartmentId, billingStartMonth: null },
  buildingBillingStartMonth: '2026-01',
  rates: [{ apartmentId: null, amountAgorot: fee, effectiveFrom: '2026-01' }],
  payments: [],
  currentMonth: '2026-06',
  ...overrides,
})

const paid = (month: string, amountAgorot = fee): MonthPayment => ({ month, amountAgorot })

describe('monthStatus', () => {
  it.each([
    ['before the billing start', billing(), '2025-12', { kind: 'not-billed' }],
    [
      'no rate applies',
      billing({ rates: [{ apartmentId: null, amountAgorot: fee, effectiveFrom: '2026-04' }] }),
      '2026-02',
      { kind: 'no-fee' },
    ],
    [
      'the current month, unpaid',
      billing(),
      '2026-06',
      { kind: 'due', dueAgorot: fee, paidAgorot: 0, remainingAgorot: fee },
    ],
    [
      'an earlier month, unpaid',
      billing(),
      '2026-03',
      { kind: 'overdue', dueAgorot: fee, paidAgorot: 0, remainingAgorot: fee },
    ],
    [
      'paid in full',
      billing({ payments: [paid('2026-03')] }),
      '2026-03',
      { kind: 'paid', dueAgorot: fee, paidAgorot: fee },
    ],
    [
      'a partial payment of the current month stays due',
      billing({ payments: [paid('2026-06', 20_000)] }),
      '2026-06',
      { kind: 'due', dueAgorot: fee, paidAgorot: 20_000, remainingAgorot: 15_000 },
    ],
    [
      'a partial payment of an earlier month stays overdue',
      billing({ payments: [paid('2026-02', 10_000)] }),
      '2026-02',
      { kind: 'overdue', dueAgorot: fee, paidAgorot: 10_000, remainingAgorot: 25_000 },
    ],
    [
      'several payments in one month together pay it',
      billing({ payments: [paid('2026-04', 15_000), paid('2026-04', 20_000)] }),
      '2026-04',
      { kind: 'paid', dueAgorot: fee, paidAgorot: fee },
    ],
    [
      "another month's payment does not count",
      billing({ payments: [paid('2026-05')] }),
      '2026-04',
      { kind: 'overdue', dueAgorot: fee, paidAgorot: 0, remainingAgorot: fee },
    ],
    [
      'a fee change mid-year: an earlier month keeps the old fee',
      billing({
        rates: [
          { apartmentId: null, amountAgorot: fee, effectiveFrom: '2026-01' },
          { apartmentId: null, amountAgorot: 40_000, effectiveFrom: '2026-05' },
        ],
        payments: [paid('2026-04')],
      }),
      '2026-04',
      { kind: 'paid', dueAgorot: fee, paidAgorot: fee },
    ],
    [
      'a fee change mid-year: the old amount no longer covers the new fee',
      billing({
        rates: [
          { apartmentId: null, amountAgorot: fee, effectiveFrom: '2026-01' },
          { apartmentId: null, amountAgorot: 40_000, effectiveFrom: '2026-05' },
        ],
        payments: [paid('2026-05')],
      }),
      '2026-05',
      { kind: 'overdue', dueAgorot: 40_000, paidAgorot: fee, remainingAgorot: 5_000 },
    ],
    [
      'an apartment added late: before its own billing start',
      billing({ apartment: { id: apartmentId, billingStartMonth: '2026-05' } }),
      '2026-04',
      { kind: 'not-billed' },
    ],
    [
      'an apartment added late: from its own billing start',
      billing({ apartment: { id: apartmentId, billingStartMonth: '2026-05' } }),
      '2026-05',
      { kind: 'overdue', dueAgorot: fee, paidAgorot: 0, remainingAgorot: fee },
    ],
    [
      'a later month paid in advance',
      billing({ payments: [paid('2026-07')] }),
      '2026-07',
      { kind: 'paid', dueAgorot: fee, paidAgorot: fee },
    ],
    [
      'a later month not yet paid is upcoming',
      billing(),
      '2026-07',
      { kind: 'upcoming', dueAgorot: fee, paidAgorot: 0, remainingAgorot: fee },
    ],
    [
      'a later month partly paid ahead is upcoming, with what remains',
      billing({ payments: [paid('2026-08', 10_000)] }),
      '2026-08',
      { kind: 'upcoming', dueAgorot: fee, paidAgorot: 10_000, remainingAgorot: 25_000 },
    ],
  ] as const)('%s', (_, input, month, expected) => {
    expect(monthStatus(input, month)).toEqual(expected)
  })
})

describe('the month boundary in Israel', () => {
  // Paid through October, nothing for November.
  const paidThroughOctober = (now: Date) =>
    billing({
      buildingBillingStartMonth: '2026-10',
      payments: [paid('2026-10')],
      currentMonth: currentMonthIn('Asia/Jerusalem', now),
    })

  it('31 October at 23:30 in Israel (21:30 UTC) is still October', () => {
    const input = paidThroughOctober(new Date('2026-10-31T21:30:00Z'))
    expect(input.currentMonth).toBe('2026-10')
    expect(apartmentSummary(input).current.kind).toBe('paid')
  })

  it('1 November at 00:30 in Israel (still 31 October in UTC) is November', () => {
    const input = paidThroughOctober(new Date('2026-10-31T22:30:00Z'))
    expect(input.currentMonth).toBe('2026-11')
    expect(apartmentSummary(input).current).toEqual({
      kind: 'due',
      dueAgorot: fee,
      paidAgorot: 0,
      remainingAgorot: fee,
    })
  })

  it('an unpaid October turns overdue once November starts in Israel', () => {
    const at = (instant: string) =>
      monthStatus(
        billing({
          buildingBillingStartMonth: '2026-10',
          currentMonth: currentMonthIn('Asia/Jerusalem', new Date(instant)),
        }),
        '2026-10',
      ).kind
    expect(at('2026-10-31T21:30:00Z')).toBe('due')
    expect(at('2026-10-31T22:30:00Z')).toBe('overdue')
  })
})

describe('apartmentSummary', () => {
  const rates: FeeRate[] = [{ apartmentId: null, amountAgorot: fee, effectiveFrom: '2026-01' }]
  const monthsPaid = (...months: string[]) => months.map((month) => paid(month))

  it.each([
    [
      'everything paid',
      billing({
        payments: monthsPaid('2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'),
      }),
      { current: { kind: 'paid', dueAgorot: fee, paidAgorot: fee }, monthsBehind: 0, total: 0 },
    ],
    [
      'only the current month open',
      billing({ payments: monthsPaid('2026-01', '2026-02', '2026-03', '2026-04', '2026-05') }),
      {
        current: { kind: 'due', dueAgorot: fee, paidAgorot: 0, remainingAgorot: fee },
        monthsBehind: 0,
        total: fee,
      },
    ],
    [
      'two months behind and the current month open',
      billing({ payments: monthsPaid('2026-01', '2026-02', '2026-03') }),
      {
        current: { kind: 'due', dueAgorot: fee, paidAgorot: 0, remainingAgorot: fee },
        monthsBehind: 2,
        total: 3 * fee,
      },
    ],
    [
      'a partial earlier month counts as behind, for its remaining amount',
      billing({
        payments: [
          ...monthsPaid('2026-01', '2026-02', '2026-03', '2026-04', '2026-06'),
          paid('2026-05', 30_000),
        ],
      }),
      { current: { kind: 'paid', dueAgorot: fee, paidAgorot: fee }, monthsBehind: 1, total: 5_000 },
    ],
    [
      'an apartment added late owes only from its own start',
      billing({ apartment: { id: apartmentId, billingStartMonth: '2026-05' } }),
      {
        current: { kind: 'due', dueAgorot: fee, paidAgorot: 0, remainingAgorot: fee },
        monthsBehind: 1,
        total: 2 * fee,
      },
    ],
    [
      'billing has not started',
      billing({ apartment: { id: apartmentId, billingStartMonth: '2026-09' } }),
      { current: { kind: 'not-billed' }, monthsBehind: 0, total: 0 },
    ],
    [
      'no fee set yet',
      billing({ rates: [] }),
      { current: { kind: 'no-fee' }, monthsBehind: 0, total: 0 },
    ],
    [
      'a fee change counts each month at its own fee',
      billing({
        rates: [...rates, { apartmentId: null, amountAgorot: 40_000, effectiveFrom: '2026-05' }],
        payments: monthsPaid('2026-01', '2026-02', '2026-03'),
      }),
      {
        current: { kind: 'due', dueAgorot: 40_000, paidAgorot: 0, remainingAgorot: 40_000 },
        monthsBehind: 2,
        total: fee + 2 * 40_000,
      },
    ],
  ] as const)('%s', (_, input, expected) => {
    expect(apartmentSummary(input)).toEqual({
      current: expected.current,
      monthsBehind: expected.monthsBehind,
      totalOwedAgorot: expected.total,
    })
  })
})

describe('apartmentStanding', () => {
  const due = { kind: 'due', dueAgorot: fee, paidAgorot: 0, remainingAgorot: fee } as const
  const paidMonth = { kind: 'paid', dueAgorot: fee, paidAgorot: fee } as const

  it.each([
    ['paid up', { current: paidMonth, monthsBehind: 0, totalOwedAgorot: 0 }, { kind: 'paid' }],
    [
      'the current month due',
      { current: due, monthsBehind: 0, totalOwedAgorot: fee },
      { kind: 'due', remainingAgorot: fee, partial: false },
    ],
    [
      'the current month partly paid',
      {
        current: { ...due, paidAgorot: 10_000, remainingAgorot: 25_000 },
        monthsBehind: 0,
        totalOwedAgorot: 25_000,
      },
      { kind: 'due', remainingAgorot: 25_000, partial: true },
    ],
    [
      'behind, with the current month due',
      { current: due, monthsBehind: 2, totalOwedAgorot: 3 * fee },
      { kind: 'overdue', monthsBehind: 2, totalOwedAgorot: 3 * fee },
    ],
    [
      'behind, though the current month is paid',
      { current: paidMonth, monthsBehind: 1, totalOwedAgorot: fee },
      { kind: 'overdue', monthsBehind: 1, totalOwedAgorot: fee },
    ],
    [
      'behind, in a month with no fee',
      { current: { kind: 'no-fee' }, monthsBehind: 1, totalOwedAgorot: fee },
      { kind: 'overdue', monthsBehind: 1, totalOwedAgorot: fee },
    ],
    [
      'no fee this month',
      { current: { kind: 'no-fee' }, monthsBehind: 0, totalOwedAgorot: 0 },
      { kind: 'no-fee' },
    ],
    [
      'not billed yet',
      { current: { kind: 'not-billed' }, monthsBehind: 0, totalOwedAgorot: 0 },
      { kind: 'not-billed' },
    ],
  ] as const)('%s', (_name, summary, expected) => {
    expect(apartmentStanding(summary)).toEqual(expected)
  })
})

describe('openMonths', () => {
  const open = (month: string, kind: 'overdue' | 'due' | 'upcoming', paidAgorot = 0) => ({
    month,
    kind,
    dueAgorot: fee,
    paidAgorot,
    remainingAgorot: fee - paidAgorot,
  })

  it('lists every month not fully paid, from billing start to the last month, oldest first', () => {
    const paidUpTo = ['2026-01', '2026-02', '2026-03', '2026-05'].map((month) => paid(month))
    expect(openMonths(billing({ payments: paidUpTo }), '2026-08')).toEqual([
      open('2026-04', 'overdue'),
      open('2026-06', 'due'),
      open('2026-07', 'upcoming'),
      open('2026-08', 'upcoming'),
    ])
  })

  it('keeps a partly paid month with what remains', () => {
    expect(
      openMonths(
        billing({ payments: [paid('2026-06', 10_000)], currentMonth: '2026-06' }),
        '2026-06',
      ).at(-1),
    ).toEqual(open('2026-06', 'due', 10_000))
  })

  it('leaves out months without a fee and months before billing starts', () => {
    const rates = [{ apartmentId: null, amountAgorot: fee, effectiveFrom: '2026-05' }]
    expect(
      openMonths(
        billing({ apartment: { id: apartmentId, billingStartMonth: '2026-03' }, rates }),
        '2026-06',
      ).map(({ month }) => month),
    ).toEqual(['2026-05', '2026-06'])
  })

  it('is empty when everything is paid', () => {
    const payments = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'].map(
      (month) => paid(month),
    )
    expect(openMonths(billing({ payments }), '2026-06')).toEqual([])
  })
})

describe('residentMonths', () => {
  const owing = (month: string, kind: 'overdue' | 'due' | 'upcoming', paidAgorot = 0) => ({
    month,
    kind,
    dueAgorot: fee,
    paidAgorot,
    remainingAgorot: fee - paidAgorot,
  })
  const settled = (month: string) => ({ month, kind: 'paid', dueAgorot: fee, paidAgorot: fee })

  it("is the current year's twelve months, January first, each with its status", () => {
    const result = residentMonths(
      billing({
        buildingBillingStartMonth: '2026-03',
        payments: [paid('2026-03'), paid('2026-04'), paid('2026-06', 10_000), paid('2026-08')],
      }),
    )

    expect(result).toEqual([
      { month: '2026-01', kind: 'not-billed' },
      { month: '2026-02', kind: 'not-billed' },
      settled('2026-03'),
      settled('2026-04'),
      owing('2026-05', 'overdue'),
      owing('2026-06', 'due', 10_000),
      owing('2026-07', 'upcoming'),
      // Paid ahead.
      settled('2026-08'),
      owing('2026-09', 'upcoming'),
      owing('2026-10', 'upcoming'),
      owing('2026-11', 'upcoming'),
      owing('2026-12', 'upcoming'),
    ])
  })

  it('puts the months still owed from earlier years first, oldest first', () => {
    const result = residentMonths(
      billing({
        buildingBillingStartMonth: '2025-10',
        rates: [{ apartmentId: null, amountAgorot: fee, effectiveFrom: '2025-10' }],
        payments: [paid('2025-11'), paid('2025-12', 5_000), paid('2026-01')],
        currentMonth: '2026-01',
      }),
    )

    expect(result.slice(0, 4)).toEqual([
      owing('2025-10', 'overdue'),
      owing('2025-12', 'overdue', 5_000),
      settled('2026-01'),
      owing('2026-02', 'upcoming'),
    ])
    expect(result).toHaveLength(14)
  })

  it("adds next year's months paid ahead, in full or in part, after this year's", () => {
    const result = residentMonths(
      billing({
        currentMonth: '2026-12',
        payments: [paid('2027-01'), paid('2027-02', 10_000)],
      }),
    )

    expect(result.slice(11)).toEqual([
      owing('2026-12', 'due'),
      settled('2027-01'),
      owing('2027-02', 'upcoming', 10_000),
    ])
    // Months ahead with nothing paid are left out.
    expect(result).toHaveLength(14)
  })

  it('shows months without a fee as such', () => {
    const rates = [{ apartmentId: null, amountAgorot: fee, effectiveFrom: '2026-06' }]
    expect(residentMonths(billing({ rates })).slice(4, 6)).toEqual([
      { month: '2026-05', kind: 'no-fee' },
      owing('2026-06', 'due'),
    ])
  })
})
