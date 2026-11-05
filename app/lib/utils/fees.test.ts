import { describe, expect, it } from 'vitest'
import type { FeeRate } from '@/app/lib/definitions'
import { feeFor } from './fees'

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
