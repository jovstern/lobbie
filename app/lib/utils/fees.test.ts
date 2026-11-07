import { describe, expect, it } from 'vitest'
import type { FeeRate } from '@/app/lib/definitions'
import { feeFor, feeInForce, feePeriods, followBuildingMonth } from './fees'

const apartment = 'apt-1'
const neighbour = 'apt-2'

const rate = (amountAgorot: number, effectiveFrom: string, apartmentId: string | null = null) => ({
  apartmentId,
  amountAgorot,
  effectiveFrom,
})

describe('feeFor', () => {
  const midYearChange: FeeRate[] = [rate(35_000, '2026-01'), rate(40_000, '2026-07')]
  const lateOverride: FeeRate[] = [rate(35_000, '2026-01'), rate(45_000, '2026-05', apartment)]
  const unordered: FeeRate[] = [
    rate(40_000, '2026-07'),
    rate(30_000, '2025-01'),
    rate(35_000, '2026-01'),
  ]

  it.each([
    ['no rates at all', [], '2026-03', null],
    ['before the first rate', midYearChange, '2025-12', null],
    ['the month a rate starts', midYearChange, '2026-01', 35_000],
    ['a fee change mid-year: earlier months keep the old fee', midYearChange, '2026-06', 35_000],
    ['a fee change mid-year: the new fee from its month', midYearChange, '2026-07', 40_000],
    ['a fee change mid-year: and after it', midYearChange, '2027-02', 40_000],
    ['an override starting later: the default before it', lateOverride, '2026-04', 35_000],
    ['an override starting later: the override from its month', lateOverride, '2026-05', 45_000],
    ['rates in any order', unordered, '2025-06', 30_000],
    ['rates in any order, latest applicable', unordered, '2026-08', 40_000],
  ] as const)('%s', (_, rates, month, expected) => {
    expect(feeFor([...rates], apartment, month)).toBe(expected)
  })

  it('an override beats a newer default', () => {
    const rates = [rate(45_000, '2026-01', apartment), rate(50_000, '2026-06')]
    expect(feeFor(rates, apartment, '2026-08')).toBe(45_000)
  })

  it("ignores another apartment's override", () => {
    const rates = [rate(35_000, '2026-01'), rate(45_000, '2026-01', neighbour)]
    expect(feeFor(rates, apartment, '2026-03')).toBe(35_000)
    expect(feeFor(rates, neighbour, '2026-03')).toBe(45_000)
  })

  it('an override alone, with no default, applies only to its apartment', () => {
    const rates = [rate(45_000, '2026-01', apartment)]
    expect(feeFor(rates, apartment, '2026-03')).toBe(45_000)
    expect(feeFor(rates, neighbour, '2026-03')).toBeNull()
  })
})

describe('feeInForce', () => {
  const rates: FeeRate[] = [rate(35_000, '2026-01'), rate(45_000, '2026-05', apartment)]

  it.each([
    ['nothing before the first rate', '2025-12', null],
    [
      "the building's fee before the override starts",
      '2026-04',
      { amountAgorot: 35_000, source: 'building' },
    ],
    [
      "the apartment's own fee from its month",
      '2026-05',
      { amountAgorot: 45_000, source: 'apartment' },
    ],
  ] as const)('%s', (_, month, expected) => {
    expect(feeInForce(rates, apartment, month)).toEqual(expected)
  })

  it("is the building's fee for an apartment without one of its own", () => {
    expect(feeInForce(rates, neighbour, '2026-06')).toEqual({
      amountAgorot: 35_000,
      source: 'building',
    })
  })
})

describe('feePeriods', () => {
  const entry = (id: string, effectiveFrom: string) => ({ id, effectiveFrom })

  it('is empty without rates', () => {
    expect(feePeriods([], '2026-11')).toEqual([])
  })

  it('lists the newest first, each until the month before the next one starts', () => {
    const periods = feePeriods(
      [entry('b', '2026-07'), entry('a', '2025-11'), entry('c', '2027-01')],
      '2026-11',
    )

    expect(periods).toEqual([
      { id: 'c', effectiveFrom: '2027-01', until: null, state: 'upcoming' },
      { id: 'b', effectiveFrom: '2026-07', until: '2026-12', state: 'current' },
      { id: 'a', effectiveFrom: '2025-11', until: '2026-06', state: 'past' },
    ])
  })

  it('counts a rate starting this month as current', () => {
    expect(feePeriods([entry('a', '2026-01'), entry('b', '2026-11')], '2026-11')).toEqual([
      { id: 'b', effectiveFrom: '2026-11', until: null, state: 'current' },
      { id: 'a', effectiveFrom: '2026-01', until: '2026-10', state: 'past' },
    ])
  })

  it('has no current rate when every rate starts later', () => {
    expect(feePeriods([entry('a', '2027-01')], '2026-11')).toEqual([
      { id: 'a', effectiveFrom: '2027-01', until: null, state: 'upcoming' },
    ])
  })

  it('crosses a year boundary', () => {
    expect(feePeriods([entry('a', '2025-06'), entry('b', '2026-01')], '2026-03')[1]).toEqual({
      id: 'a',
      effectiveFrom: '2025-06',
      until: '2025-12',
      state: 'past',
    })
  })
})

describe('an apartment that follows the building again', () => {
  // Its own ₪450 from January, then the building's fee again from June; the building's fee
  // changes from ₪350 to ₪400 in September.
  const rates: FeeRate[] = [
    rate(35_000, '2026-01'),
    rate(40_000, '2026-09'),
    rate(45_000, '2026-01', apartment),
    { apartmentId: apartment, amountAgorot: null, effectiveFrom: '2026-06' },
  ]

  it.each([
    ['its own fee before it ends', '2026-05', { amountAgorot: 45_000, source: 'apartment' }],
    [
      "the building's fee from the month it ends",
      '2026-06',
      { amountAgorot: 35_000, source: 'building' },
    ],
    ["the building's later change too", '2026-09', { amountAgorot: 40_000, source: 'building' }],
  ] as const)('%s', (_, month, expected) => {
    expect(feeInForce(rates, apartment, month)).toEqual(expected)
    expect(feeFor(rates, apartment, month)).toBe(expected.amountAgorot)
  })

  it('takes its own fee again from a later row with an amount', () => {
    const again = [...rates, rate(50_000, '2026-11', apartment)]
    expect(feeInForce(again, apartment, '2026-12')).toEqual({
      amountAgorot: 50_000,
      source: 'apartment',
    })
  })

  it('is nothing when the building has no fee then', () => {
    const noDefault: FeeRate[] = [
      rate(45_000, '2026-01', apartment),
      { apartmentId: apartment, amountAgorot: null, effectiveFrom: '2026-06' },
    ]
    expect(feeInForce(noDefault, apartment, '2026-07')).toBeNull()
  })
})

describe('followBuildingMonth', () => {
  const own = (effectiveFrom: string, amountAgorot: number | null = 45_000) => ({
    effectiveFrom,
    amountAgorot,
  })

  it.each([
    ['no fee of its own', [], null],
    ['already following the building', [own('2026-10', null), own('2026-01')], null],
    ['its own fee now: from next month', [own('2026-01')], '2026-12'],
    ['its own fee from this month: from next month', [own('2026-11')], '2026-12'],
    ['its own fee still to come: from when it starts', [own('2027-02'), own('2026-01')], '2027-02'],
  ] as const)('%s', (_, periods, expected) => {
    expect(followBuildingMonth([...periods], '2026-11')).toBe(expected)
  })
})
