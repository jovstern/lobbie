import type { FeeInForce, FeePeriodState, FeeRate } from '@/app/lib/definitions'
import { addMonths } from './dates'

/** The latest of `rates` in force at `month`, or undefined. Months compare as strings. */
function latestInForce(rates: FeeRate[], month: string): FeeRate | undefined {
  let latest: FeeRate | undefined
  for (const rate of rates) {
    if (rate.effectiveFrom > month) continue
    if (!latest || rate.effectiveFrom > latest.effectiveFrom) latest = rate
  }
  return latest
}

/**
 * The fee an apartment owes for a month and whose it is, or null when no rate applies. The
 * apartment's own rate beats the building default, even a newer default, until a later row of
 * its own without an amount returns it to the building's; within each kind the latest rate
 * starting at or before the month wins, so a change never rewrites earlier months.
 */
export function feeInForce(
  rates: FeeRate[],
  apartmentId: string,
  month: string,
): FeeInForce | null {
  const override = latestInForce(
    rates.filter((rate) => rate.apartmentId === apartmentId),
    month,
  )
  // An apartment's row without an amount ends its own fee: it follows the building again.
  if (override && override.amountAgorot !== null) {
    return { amountAgorot: override.amountAgorot, source: 'apartment' }
  }
  const fallback = latestInForce(
    rates.filter((rate) => rate.apartmentId === null),
    month,
  )
  // A default always has an amount (a database check); a null one would be no fee.
  return fallback?.amountAgorot != null
    ? { amountAgorot: fallback.amountAgorot, source: 'building' }
    : null
}

/** The fee (agorot) an apartment owes for a month, or null when no rate applies. */
export function feeFor(rates: FeeRate[], apartmentId: string, month: string): number | null {
  return feeInForce(rates, apartmentId, month)?.amountAgorot ?? null
}

/**
 * One kind's rates (the building's, or one apartment's) as the periods they cover, newest
 * first: each runs until the month before the next one starts, and the latest has no end.
 * Relative to `currentMonth`, a period is past, current (in force now) or upcoming.
 */
export function feePeriods<Rate extends { effectiveFrom: string }>(
  rates: Rate[],
  currentMonth: string,
): (Rate & { until: string | null; state: FeePeriodState })[] {
  const newestFirst = rates.toSorted((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
  const current = newestFirst.find((rate) => rate.effectiveFrom <= currentMonth)
  return newestFirst.map((rate, index) => {
    const next = newestFirst[index - 1]
    const state: FeePeriodState =
      rate.effectiveFrom > currentMonth ? 'upcoming' : rate === current ? 'current' : 'past'
    return { ...rate, until: next ? addMonths(next.effectiveFrom, -1) : null, state }
  })
}

/**
 * The month an apartment's own fee would end from, offered by "Follow the building fee": next
 * month, or when its latest own fee starts if that is later. Null when there is nothing to end:
 * no own fee, or its latest row already follows the building. `periods` are its own, newest
 * first.
 */
export function followBuildingMonth(
  periods: { effectiveFrom: string; amountAgorot: number | null }[],
  currentMonth: string,
): string | null {
  const [latest] = periods
  if (!latest || latest.amountAgorot === null) return null
  const nextMonth = addMonths(currentMonth, 1)
  return latest.effectiveFrom > nextMonth ? latest.effectiveFrom : nextMonth
}
