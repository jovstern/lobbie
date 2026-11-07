/** How far ahead a payment may go: a building may be paid a year in advance. */
export const paymentMonthsAhead = 12

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
