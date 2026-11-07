import { describe, expect, it } from 'vitest'
import {
  arrearsOf,
  chosenApartment,
  earliestPaidOn,
  gridYear,
  gridYears,
  splitPayment,
  yearMonths,
} from './payments'

const owed = (month: string, remainingAgorot: number) => ({ month, remainingAgorot })

describe('splitPayment', () => {
  it('pays one month in full', () => {
    expect(splitPayment(35_000, [owed('2026-10', 35_000)])).toEqual({
      ok: true,
      parts: [{ month: '2026-10', amountAgorot: 35_000 }],
    })
  })

  it('pays part of one month', () => {
    expect(splitPayment(10_000, [owed('2026-10', 35_000)])).toEqual({
      ok: true,
      parts: [{ month: '2026-10', amountAgorot: 10_000 }],
    })
  })

  it('splits across months oldest first, whatever order they were chosen in', () => {
    expect(
      splitPayment(80_000, [
        owed('2026-11', 35_000),
        owed('2026-09', 35_000),
        owed('2026-10', 20_000),
      ]),
    ).toEqual({
      ok: true,
      parts: [
        { month: '2026-09', amountAgorot: 35_000 },
        { month: '2026-10', amountAgorot: 20_000 },
        { month: '2026-11', amountAgorot: 25_000 },
      ],
    })
  })

  it('refuses more than the months owe, saying how much they owe', () => {
    expect(splitPayment(70_001, [owed('2026-10', 35_000), owed('2026-11', 35_000)])).toEqual({
      ok: false,
      reason: 'tooMuch',
      owedAgorot: 70_000,
    })
  })

  it('refuses an amount that leaves a chosen month with nothing, naming the first such month', () => {
    expect(
      splitPayment(35_000, [
        owed('2026-10', 35_000),
        owed('2026-11', 35_000),
        owed('2026-12', 35_000),
      ]),
    ).toEqual({ ok: false, reason: 'tooLittle', month: '2026-11' })
  })
})

describe('yearMonths', () => {
  it('is the twelve months of a year, January first', () => {
    expect(yearMonths(2026)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
    ])
  })
})

describe('gridYears', () => {
  it.each([
    // From the earliest billing start to the year a payment ahead can reach.
    ['2025-11', '2026-11', { first: 2025, last: 2027 }],
    ['2026-01', '2026-01', { first: 2026, last: 2027 }],
    ['2020-03', '2026-06', { first: 2020, last: 2027 }],
    // Billing that starts later still shows the current year.
    ['2027-03', '2026-11', { first: 2026, last: 2027 }],
  ])('billing from %s, now %s: %o', (firstBilling, currentMonth, range) => {
    expect(gridYears(firstBilling, currentMonth)).toEqual(range)
  })
})

describe('gridYear', () => {
  const range = { first: 2025, last: 2027 }

  it.each([
    ['2026', 2026],
    ['2025', 2025],
    ['2027', 2027],
    // Out of range: the nearest year there is.
    ['1990', 2025],
    ['2099', 2027],
    // Not a year: the current one.
    [undefined, 2026],
    ['', 2026],
    ['twenty', 2026],
    ['2026.5', 2026],
    ['02026', 2026],
    [['2025', '2027'], 2026],
  ])('?year=%o shows %i', (param, year) => {
    expect(gridYear(param, range, 2026)).toBe(year)
  })
})

describe('arrearsOf', () => {
  const summary = (monthsBehind: number, totalOwedAgorot: number) => ({
    current: { kind: 'due' as const, dueAgorot: 35_000, paidAgorot: 0, remainingAgorot: 35_000 },
    monthsBehind,
    totalOwedAgorot,
  })

  it('lists only the apartments behind, the largest debt first, with the total', () => {
    const arrears = arrearsOf([
      { id: 'a1', number: '1', summary: summary(0, 35_000) },
      { id: 'a4', number: '4', summary: summary(1, 70_000) },
      { id: 'a9', number: '9', summary: summary(2, 105_000) },
      { id: 'a5', number: '5', summary: summary(1, 70_000) },
    ])

    expect(arrears).toEqual({
      apartments: [
        { id: 'a9', number: '9', monthsBehind: 2, totalOwedAgorot: 105_000 },
        // Equal debts keep the order they came in (natural order).
        { id: 'a4', number: '4', monthsBehind: 1, totalOwedAgorot: 70_000 },
        { id: 'a5', number: '5', monthsBehind: 1, totalOwedAgorot: 70_000 },
      ],
      totalOwedAgorot: 245_000,
    })
  })

  it('is empty when everyone is up to date', () => {
    expect(arrearsOf([{ id: 'a1', number: '1', summary: summary(0, 35_000) }])).toEqual({
      apartments: [],
      totalOwedAgorot: 0,
    })
  })
})

describe('earliestPaidOn', () => {
  it.each([
    // A year before billing starts, mirroring a payment's year ahead.
    ['2025-11', '2024-11-01'],
    ['2026-01', '2025-01-01'],
    ['2026-12', '2025-12-01'],
  ])('billing from %s: paid on %s at the earliest', (billingStart, day) => {
    expect(earliestPaidOn(billingStart)).toBe(day)
  })
})

describe('chosenApartment', () => {
  const own = ['apt-4', 'apt-9']

  it.each([
    ['no choice: the first', undefined, own, 'apt-4'],
    ['one of their own', 'apt-9', own, 'apt-9'],
    ["someone else's", 'apt-5', own, null],
    ['several at once', ['apt-4', 'apt-9'], own, null],
    ['an empty choice', '', own, null],
    ['no apartments at all', undefined, [], null],
  ] as const)('%s', (_name, param, apartmentIds, expected) => {
    expect(chosenApartment(param, apartmentIds)).toBe(expected)
  })
})
