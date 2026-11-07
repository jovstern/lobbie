import { describe, expect, it } from 'vitest'
import { splitPayment } from './payments'

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
