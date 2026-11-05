import { describe, expect, it } from 'vitest'
import { balance } from './ledger'

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
