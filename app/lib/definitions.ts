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

/** The building's settings, as the admin edits them (R7). */
export type BuildingDetails = {
  name: string
  address: string
  quorumPercent: number
  billingStartMonth: string
  openingBalanceAgorot: number
}

/** A recorded correction to the building fund: signed, never zero (R7). */
export type BalanceAdjustment = {
  id: string
  amountAgorot: number
  reason: string
  recordedByName: string
  createdAt: Date
}

/** An apartment as the admin edits it (R8); no billing start means the building's. */
export type Apartment = {
  id: string
  number: string
  floor: number
  billingStartMonth: string | null
}

/** An apartment in the admin's list, with what still points at it (see `blockersOf`). */
export type ApartmentListItem = Apartment & {
  residents: number
  activeInvites: number
  payments: number
  feeOverrides: number
}

/** An apartment's invite that still works, as the admin sees it; its code is never stored. */
export type ActiveInvite = {
  id: string
  uses: number
  maxUses: number
  expiresAt: Date
}

/** A link made by "Create invites for all apartments", shown once and never stored. */
export type CreatedInvite = {
  apartmentId: string
  apartmentNumber: string
  /** Formatted as people read it: `ABCDE-23456`. */
  code: string
  link: string
}

/** One of a person's apartments, as a link on the admin's lists. */
export type ApartmentRef = { id: string; number: string }

/**
 * A member of the building as the admin manages them (R10): no contact settings, which the
 * admin does not need here.
 */
export type Person = {
  userId: string
  name: string
  email: string
  role: Role
  /** Committee and admin only; null for everyone else. */
  committeeTitle: string | null
  /** In natural order (2 before 10). */
  apartments: ApartmentRef[]
}

/** Someone who lives in an apartment, as its admin page lists them (R10). */
export type Resident = {
  userId: string
  name: string
  email: string
  isOwner: boolean
  /** How many of the building's apartments they live in, this one included. */
  apartmentCount: number
}
