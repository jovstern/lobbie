import type { Locale } from '@/i18n/routing'
import type { expenseCategoryEnum, feeRates, paymentMethodEnum, payments, roleEnum } from './schema'

/** A fee rate as the fee logic needs it; `apartmentId` null is the building default. */
export type FeeRate = Pick<
  typeof feeRates.$inferSelect,
  'apartmentId' | 'amountAgorot' | 'effectiveFrom'
>

/** The fee an apartment owes for a month, and whether it is its own or the building's. */
export type FeeInForce = { amountAgorot: number; source: 'building' | 'apartment' }

/** Where a fee rate stands against the current month: in force now, before, or later. */
export type FeePeriodState = 'past' | 'current' | 'upcoming'

/** A fee rate as the committee sees it in the history (R14): what, from when to when, by whom. */
export type FeePeriod = {
  id: string
  /** Null on an apartment's row that ends its own fee: from then it follows the building's. */
  amountAgorot: number | null
  effectiveFrom: string
  /** The month before the next rate starts; null for the latest. */
  until: string | null
  state: FeePeriodState
  setByName: string
  setAt: Date
}

/** A building default's period, which always has an amount. */
export type BuildingFeePeriod = FeePeriod & { amountAgorot: number }

/** The building's fees (R14): its default's history and each apartment's own. */
export type FeeSchedule = {
  /** In the building's time zone. */
  currentMonth: string
  billingStartMonth: string
  /** The building default, newest first. */
  building: BuildingFeePeriod[]
  /** The apartments with a fee of their own, in natural order, each newest first. */
  apartments: { apartment: ApartmentRef; periods: FeePeriod[] }[]
  /** Every apartment of the building, in natural order, to choose one to set a fee for. */
  choices: ApartmentRef[]
}

/** One apartment's fee (R14): what it pays this month, and its own fees' history. */
export type ApartmentFees = {
  currentMonth: string
  /** Null when no fee applies yet. */
  inForce: FeeInForce | null
  /** Its own fees, newest first; empty when it pays the building's. */
  periods: FeePeriod[]
  /** The building's next fee, when one is set for a later month and it pays the building's. */
  upcomingBuildingFee: { amountAgorot: number; effectiveFrom: string } | null
}

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

/** A month a payment can still go to (R15): not fully paid, with what remains of its fee. */
export type OpenMonth = {
  month: string
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
  | {
      kind: 'overdue'
      monthsBehind: number
      /** What remains of the overdue months and the current one. */
      totalOwedAgorot: number
      /** What remains of the overdue months alone; the rest of the total is due this month. */
      overdueAgorot: number
    }

export type PaymentMethod = (typeof paymentMethodEnum.enumValues)[number]

export type ExpenseCategory = (typeof expenseCategoryEnum.enumValues)[number]

/** An expense as the committee sees it on `/admin/expenses` (R18). */
export type AdminExpense = {
  id: string
  category: ExpenseCategory
  amountAgorot: number
  /** The calendar date it was spent, `YYYY-MM-DD`. */
  spentOn: string
  description: string
  /** The receipt's storage key, served by `/api/files/[id]`; null without one. */
  receiptKey: string | null
  recordedByName: string
  /** Null while it counts; a voided expense stays listed, never edited. */
  voided: { at: Date; byName: string; reason: string } | null
}

/** One year of the building's expenses for the committee, with the dates a new one may carry. */
export type AdminExpenses = {
  /** The year shown. */
  year: number
  /** The years there are: from billing start (or an earlier expense) to this one. */
  years: YearRange
  /** The year's, newest first, voided ones included. */
  expenses: AdminExpense[]
  /** `YYYY-MM-DD` in the building's time zone: an expense is spent on it or earlier. */
  today: string
  /** `YYYY-MM-DD`: the earliest date an expense may carry, the day billing starts. */
  firstDay: string
}

/**
 * An expense as every member sees it on `/money/balance` (R19): only those that count, and
 * never who recorded it.
 */
export type BuildingExpense = {
  id: string
  category: ExpenseCategory
  amountAgorot: number
  /** The calendar date it was spent, `YYYY-MM-DD`. */
  spentOn: string
  description: string
  /** The receipt's storage key, served by `/api/files/[id]`; null without one. */
  receiptKey: string | null
}

/** A month of the building fund: what came in (payments) and went out (expenses). */
export type LedgerMonth = { month: string; incomeAgorot: number; expensesAgorot: number }

/** One year of the building fund (R19), by its payments', expenses' and corrections' dates. */
export type LedgerYear = {
  year: number
  /** The years there is something to show, this one last. */
  years: YearRange
  /** The payments that count, paid on a day of the year. */
  incomeAgorot: number
  /** The expenses that count, spent on a day of the year. */
  expensesAgorot: number
  /** The corrections recorded in the year (in the building's time zone), signed. */
  adjustmentsAgorot: number
  /** The year's expenses by category, the largest first; none without expenses. */
  categories: { category: ExpenseCategory; amountAgorot: number }[]
  /** The year's months up to this one, January first. */
  months: LedgerMonth[]
  /** The year's expenses that count, newest first. */
  expenses: BuildingExpense[]
}

/** A payment as the committee sees it on an apartment's page (R15). */
export type PaymentEntry = {
  id: string
  month: string
  amountAgorot: number
  /** The calendar date it was paid, `YYYY-MM-DD`. */
  paidOn: string
  method: PaymentMethod
  note: string | null
  recordedByName: string
  /** Null while it counts; a voided payment stays listed, never edited. */
  voided: { at: Date; byName: string; reason: string } | null
}

/** One apartment's payments, for the committee to record and void (R15). */
export type ApartmentPayments = {
  number: string
  /** In the building's time zone. */
  currentMonth: string
  /** `YYYY-MM-DD` in the building's time zone: a payment is paid on it or earlier. */
  today: string
  /** `YYYY-MM-DD`: the earliest date a payment may carry, a year before billing starts. */
  firstDay: string
  standing: ApartmentStanding
  /** The last month a payment may go to: a year ahead. */
  lastMonth: string
  /** The months a payment can still go to, oldest first, up to `lastMonth`. */
  openMonths: OpenMonth[]
  /** The latest payments, newest month first. */
  history: PaymentEntry[]
  /** Whether it has more payments than `history` lists. */
  historyLimited: boolean
}

/** One of the person's own apartments on `/money` (R16): how it stands, and its months. */
export type ApartmentMonths = {
  number: string
  /** In the building's time zone. */
  currentMonth: string
  standing: ApartmentStanding
  /**
   * Months of earlier years still owed, then the current year's twelve, then months of a later
   * year paid ahead (in full or in part); oldest first.
   */
  months: GridMonth[]
}

/**
 * A payment as the apartment's residents see it on `/money`: what, when and how. Never who
 * recorded or voided it, nor the committee's note.
 */
export type ResidentPayment = {
  id: string
  month: string
  amountAgorot: number
  /** The calendar date it was paid, `YYYY-MM-DD`. */
  paidOn: string
  method: PaymentMethod
  /** Null while it counts; a voided payment stays listed, with when and why. */
  voided: { at: Date; reason: string } | null
}

/** An apartment behind on its payments, as the committee's arrears list shows it (R17). */
export type ArrearsEntry = {
  id: string
  number: string
  /** Earlier months not fully paid. */
  monthsBehind: number
  /** What remains of those months and the current one. */
  totalOwedAgorot: number
  /** What remains of the overdue months alone; the rest of the total is due this month. */
  overdueAgorot: number
}

/** Who is behind, the largest debt first, and what they owe together. */
export type Arrears = { apartments: ArrearsEntry[]; totalOwedAgorot: number }

/** A month of one apartment and its status: a cell of the payments grid, a row on `/money`. */
export type GridMonth = MonthStatus & { month: string }

/** One apartment's row of the payments grid. */
export type GridRow = {
  id: string
  number: string
  standing: ApartmentStanding
  /** The twelve months of the year shown, January first. */
  months: GridMonth[]
}

/** `/admin/payments` (R17): every apartment's months of one year, and who is behind. */
export type PaymentsGrid = {
  year: number
  /** The years the grid can show: from the earliest billing start to a year ahead. */
  years: YearRange
  /** In the building's time zone. */
  currentMonth: string
  /** In natural order (2 before 10). */
  rows: GridRow[]
  arrears: Arrears
}

export type YearRange = { first: number; last: number }

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
  /** When its active invite stops working, or null when it has none. */
  activeInviteExpiresAt: Date | null
  /** Its invites whose every place was taken (revoked ones not counted). */
  usedUpInvites: number
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

/**
 * Someone on the residents' directory (R11). Phone and email are null unless they chose to
 * show them: the query never reads them otherwise.
 */
export type DirectoryResident = {
  userId: string
  /**
   * Null when they have not given one yet. The page then shows their email if they share it,
   * and otherwise a neutral label: the directory never shows an email its owner keeps hidden.
   */
  name: string | null
  isOwner: boolean
  phone: string | null
  email: string | null
}

/** An apartment on the directory, with the residents who match the search, by name. */
export type DirectoryApartment = {
  id: string
  number: string
  residents: DirectoryResident[]
}

/** One floor of the directory, its apartments in natural order. */
export type DirectoryFloor = {
  floor: number
  apartments: DirectoryApartment[]
}

/**
 * A committee member or admin as the building sees them (R12): the contact they publish for
 * the role, never their personal one.
 */
export type CommitteeMember = {
  userId: string
  /**
   * Null when they have not given one yet: the page then shows the email they publish for the
   * role, never their personal one.
   */
  name: string | null
  role: Exclude<Role, 'resident'>
  committeeTitle: string | null
  committeePhone: string | null
  committeeEmail: string | null
}

/** The signed-in member's own profile and settings, as `/profile` edits them (R13). */
export type Profile = {
  name: string
  /** The sign-in identity: shown, never edited here. */
  email: string
  /** E.164 (`+9725…`), or null when not given. */
  phone: string | null
  /** The language saved to the profile; the page's own language may differ. */
  locale: Locale
  role: Role
  /** Whether neighbours see their phone and email in the directory. */
  showContact: boolean
  committeeTitle: string | null
  committeePhone: string | null
  committeeEmail: string | null
}
