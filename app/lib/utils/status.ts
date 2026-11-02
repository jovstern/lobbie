import type { ApartmentSummary, FeeRate, MonthPayment, MonthStatus } from '@/app/lib/definitions'
import { addMonths } from './dates'
import { feeFor } from './fees'

/** Everything needed to work out what one apartment owes. */
export type ApartmentBilling = {
  /** `billingStartMonth` null means the building's. */
  apartment: { id: string; billingStartMonth: string | null }
  buildingBillingStartMonth: string
  rates: FeeRate[]
  /** Non-voided payments of this apartment; voids are filtered where the data is read. */
  payments: MonthPayment[]
  /** The current month in the building's time zone. */
  currentMonth: string
}

function billingStart(billing: ApartmentBilling): string {
  return billing.apartment.billingStartMonth ?? billing.buildingBillingStartMonth
}

function paidFor(payments: MonthPayment[], month: string): number {
  return payments
    .filter((payment) => payment.month === month)
    .reduce((sum, payment) => sum + payment.amountAgorot, 0)
}

function unpaidKind(month: string, currentMonth: string): 'overdue' | 'due' | 'upcoming' {
  if (month < currentMonth) return 'overdue'
  return month === currentMonth ? 'due' : 'upcoming'
}

/**
 * The status of one month (spec §3, "Month status"). An unpaid month before the current one
 * is overdue, the current month is due, and a later one not yet paid ahead is upcoming. A
 * partial payment keeps the status and shows what remains.
 */
export function monthStatus(billing: ApartmentBilling, month: string): MonthStatus {
  if (month < billingStart(billing)) return { kind: 'not-billed' }
  const dueAgorot = feeFor(billing.rates, billing.apartment.id, month)
  if (dueAgorot === null) return { kind: 'no-fee' }
  const paidAgorot = paidFor(billing.payments, month)
  if (paidAgorot >= dueAgorot) return { kind: 'paid', dueAgorot, paidAgorot }
  return {
    kind: unpaidKind(month, billing.currentMonth),
    dueAgorot,
    paidAgorot,
    remainingAgorot: dueAgorot - paidAgorot,
  }
}

/** The current month's status, plus what is owed from the billing start up to it. */
export function apartmentSummary(billing: ApartmentBilling): ApartmentSummary {
  let monthsBehind = 0
  let totalOwedAgorot = 0
  for (
    let month = billingStart(billing);
    month <= billing.currentMonth;
    month = addMonths(month, 1)
  ) {
    const status = monthStatus(billing, month)
    if (status.kind === 'overdue') monthsBehind += 1
    if (status.kind === 'overdue' || status.kind === 'due')
      totalOwedAgorot += status.remainingAgorot
  }
  return { current: monthStatus(billing, billing.currentMonth), monthsBehind, totalOwedAgorot }
}
