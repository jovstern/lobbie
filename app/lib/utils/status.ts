import type {
  ApartmentStanding,
  ApartmentSummary,
  FeeRate,
  GridMonth,
  MonthPayment,
  MonthStatus,
  OpenMonth,
} from '@/app/lib/definitions'
import { addMonths } from './dates'
import { feeFor } from './fees'
import { overdueAgorot, yearMonths } from './payments'

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

/**
 * The months a payment can still go to, oldest first: from the billing start to `lastMonth`,
 * each one with a fee that is not fully paid (overdue, due, or upcoming when paid ahead), with
 * what remains of it.
 */
export function openMonths(billing: ApartmentBilling, lastMonth: string): OpenMonth[] {
  const open: OpenMonth[] = []
  for (let month = billingStart(billing); month <= lastMonth; month = addMonths(month, 1)) {
    const status = monthStatus(billing, month)
    if (status.kind === 'overdue' || status.kind === 'due' || status.kind === 'upcoming') {
      open.push({ month, ...status })
    }
  }
  return open
}

/**
 * The months `/money` lists for an apartment (R16): every month of the current year, January
 * first, each with its status; before them any month of an earlier year still owed, and after
 * them any month of a later year paid ahead, in full or in part, so neither what is owed nor
 * what was paid is out of sight.
 */
export function residentMonths(billing: ApartmentBilling): GridMonth[] {
  const year = Number(billing.currentMonth.slice(0, 4))
  const january = `${year}-01`
  const nextJanuary = `${year + 1}-01`
  const owedBefore: GridMonth[] = []
  for (let month = billingStart(billing); month < january; month = addMonths(month, 1)) {
    const status = monthStatus(billing, month)
    if (status.kind === 'overdue') owedBefore.push({ month, ...status })
  }
  const thisYear = yearMonths(year).map((month) => ({ month, ...monthStatus(billing, month) }))
  // Payments may go a year ahead, so they are the only later months worth listing.
  const paidAhead = [...new Set(billing.payments.map((payment) => payment.month))]
    .filter((month) => month >= nextJanuary)
    .toSorted()
    .map((month) => ({ month, ...monthStatus(billing, month) }))
  return [...owedBefore, ...thisYear, ...paidAhead]
}

/**
 * What Home says about an apartment. Being behind outweighs the current month: an apartment
 * that owes earlier months is overdue even when this month is paid or has no fee.
 */
export function apartmentStanding(summary: ApartmentSummary): ApartmentStanding {
  const { current, monthsBehind, totalOwedAgorot } = summary
  if (monthsBehind > 0) {
    return { kind: 'overdue', monthsBehind, totalOwedAgorot, overdueAgorot: overdueAgorot(summary) }
  }
  switch (current.kind) {
    case 'not-billed':
    case 'no-fee':
    case 'paid':
      return { kind: current.kind }
    // The current month is never upcoming; were it so, it would read as due.
    case 'due':
    case 'overdue':
    case 'upcoming':
      return {
        kind: 'due',
        remainingAgorot: current.remainingAgorot,
        partial: current.paidAgorot > 0,
      }
  }
}
