import type { FeeRate } from '@/app/lib/definitions'

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
 * The fee (agorot) an apartment owes for a month, or null when no rate applies. The
 * apartment's own rate beats the building default, even a newer default; within each kind
 * the latest rate starting at or before the month wins, so a change never rewrites earlier
 * months.
 */
export function feeFor(rates: FeeRate[], apartmentId: string, month: string): number | null {
  const override = latestInForce(
    rates.filter((rate) => rate.apartmentId === apartmentId),
    month,
  )
  const fallback = latestInForce(
    rates.filter((rate) => rate.apartmentId === null),
    month,
  )
  return (override ?? fallback)?.amountAgorot ?? null
}
