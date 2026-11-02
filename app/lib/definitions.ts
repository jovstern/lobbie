import type { feeRates, payments, roleEnum } from './schema'

/** A fee rate as the fee logic needs it; `apartmentId` null is the building default. */
export type FeeRate = Pick<
  typeof feeRates.$inferSelect,
  'apartmentId' | 'amountAgorot' | 'effectiveFrom'
>

/** A non-voided payment (or a month's sum of them) toward one month's fee. */
export type MonthPayment = Pick<typeof payments.$inferSelect, 'month' | 'amountAgorot'>

export type MonthStatus =
  | { kind: 'not-billed' }
  | { kind: 'no-fee' }
  | { kind: 'paid'; dueAgorot: number; paidAgorot: number }
  | {
      // overdue: before the current month; due: the current month; upcoming: a later one.
      kind: 'overdue' | 'due' | 'upcoming'
      dueAgorot: number
      paidAgorot: number
      remainingAgorot: number
    }

export type ApartmentSummary = {
  /** The status of the current month in the building's time zone. */
  current: MonthStatus
  /** Earlier months not fully paid. */
  monthsBehind: number
  /** What remains of the overdue months and the current one. */
  totalOwedAgorot: number
}

/** An apartment's summary, with the number people know it by. */
export type ApartmentStatus = ApartmentSummary & { number: string }

/** How an apartment stands overall, as Home shows it (see `apartmentStanding`). */
export type ApartmentStanding =
  | { kind: 'not-billed' }
  | { kind: 'no-fee' }
  | { kind: 'paid' }
  | { kind: 'due'; remainingAgorot: number; partial: boolean }
  | { kind: 'overdue'; monthsBehind: number; totalOwedAgorot: number }

export type BuildingBalance = {
  openingBalanceAgorot: number
  adjustmentsAgorot: number
  paymentsAgorot: number
  expensesAgorot: number
  totalAgorot: number
}

/** A member's role in their building, lowest first. */
export type Role = (typeof roleEnum.enumValues)[number]

/** The signed-in person as a member of their building (one building per user, spec §3). */
export type Member = {
  userId: string
  buildingId: string
  role: Role
  apartmentIds: string[]
  isDemo: boolean
  timeZone: string
  buildingName: string
}
