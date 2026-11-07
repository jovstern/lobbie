import 'server-only'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { cacheLife, cacheTag } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { z } from 'zod'
import { requireMember, requireRole } from '@/app/lib/authz'
import { readBilling } from '@/app/lib/billing'
import { byNumber } from '@/app/lib/data/apartments'
import { buildingTag, feesTag } from '@/app/lib/data/cache-tags'
import { db } from '@/app/lib/db'
import type {
  ApartmentMonths,
  ApartmentPayments,
  ApartmentStatus,
  Arrears,
  PaymentsGrid,
  ResidentPayment,
} from '@/app/lib/definitions'
import { logger } from '@/app/lib/logger'
import {
  apartmentResidents,
  apartments,
  buildingMembers,
  buildings,
  feeRates,
  payments,
  user,
} from '@/app/lib/schema'
import { addMonths, currentMonthIn, todayIn } from '@/app/lib/utils/dates'
import {
  arrearsOf,
  earliestPaidOn,
  gridYear,
  gridYears,
  paymentMonthsAhead,
  yearMonths,
} from '@/app/lib/utils/payments'
import {
  apartmentStanding,
  apartmentSummary,
  monthStatus,
  openMonths,
  residentMonths,
  type ApartmentBilling,
} from '@/app/lib/utils/status'

// postgres-js returns some numeric results as strings; the sum is checked to be an integer.
const monthPaymentRow = z.object({
  apartmentId: z.string(),
  month: z.string(),
  amountAgorot: z.coerce.number().int(),
})

/**
 * What every apartment of the building shares: its time zone, billing start and fee rates
 * (the building's and each apartment's). Cached per building until a write updates its tag.
 */
async function buildingBilling(buildingId: string) {
  'use cache'
  cacheTag(buildingTag(buildingId), feesTag(buildingId))
  cacheLife('hours')
  const [[building], rates] = await Promise.all([
    db
      .select({ timezone: buildings.timezone, billingStartMonth: buildings.billingStartMonth })
      .from(buildings)
      .where(eq(buildings.id, buildingId)),
    db
      .select({
        apartmentId: feeRates.apartmentId,
        amountAgorot: feeRates.amountAgorot,
        effectiveFrom: feeRates.effectiveFrom,
      })
      .from(feeRates)
      .where(eq(feeRates.buildingId, buildingId)),
  ])
  return { building, rates }
}

// The person's own apartments and their payments, two queries sent together (one round trip).
// Both start from `apartment_residents` for this user and keep only apartments of the building
// the user is a member of, so another person's apartment or another building's cannot appear.
function userBilling(userId: string) {
  const ownApartment = and(
    eq(apartmentResidents.apartmentId, apartments.id),
    eq(apartmentResidents.userId, userId),
  )
  const inOwnBuilding = and(
    eq(buildingMembers.userId, userId),
    eq(buildingMembers.buildingId, apartments.buildingId),
  )
  return Promise.all([
    db
      .select({
        id: apartments.id,
        buildingId: apartments.buildingId,
        number: apartments.number,
        billingStartMonth: apartments.billingStartMonth,
      })
      .from(apartments)
      .innerJoin(apartmentResidents, ownApartment)
      .innerJoin(buildingMembers, inOwnBuilding)
      // Natural order (2 before 10), as in the membership.
      .orderBy(sql`length(${apartments.number})`, apartments.number),
    db
      .select({
        apartmentId: payments.apartmentId,
        month: payments.month,
        amountAgorot: sql`cast(sum(${payments.amountAgorot}) as integer)`,
      })
      .from(payments)
      .innerJoin(apartments, eq(apartments.id, payments.apartmentId))
      .innerJoin(apartmentResidents, ownApartment)
      .innerJoin(buildingMembers, inOwnBuilding)
      .where(and(eq(payments.buildingId, apartments.buildingId), isNull(payments.voidedAt)))
      .groupBy(payments.apartmentId, payments.month),
  ])
}

/**
 * What each of the person's apartments owes, with its number, keyed by apartment id in
 * natural order. Scoped by construction: only apartments the user lives in, in the building
 * they belong to. One uncached round trip; the building's part comes from the cache.
 */
export async function statusForUser(
  userId: string,
  now: Date = new Date(),
): Promise<Map<string, ApartmentStatus>> {
  try {
    const [apartmentRows, paymentRows] = await userBilling(userId)
    const [first] = apartmentRows
    if (!first) return new Map()
    const { building, rates } = await buildingBilling(first.buildingId)
    if (!building) throw new Error(`No building ${first.buildingId}`)
    const paymentsByApartment = Map.groupBy(
      z.array(monthPaymentRow).parse(paymentRows),
      (payment) => payment.apartmentId,
    )
    const currentMonth = currentMonthIn(building.timezone, now)

    return new Map(
      apartmentRows.map((apartment) => {
        const summary = apartmentSummary({
          apartment,
          buildingBillingStartMonth: building.billingStartMonth,
          rates,
          payments: paymentsByApartment.get(apartment.id) ?? [],
          currentMonth,
        })
        return [apartment.id, { number: apartment.number, ...summary }]
      }),
    )
  } catch (err) {
    // Next's own signals (such as a prerender that ended) are not failures.
    unstable_rethrow(err)
    logger.error('Failed to load payment statuses', { area: 'data/payments', userId, err })
    throw new Error('Failed to load payment statuses')
  }
}

/** How many of an apartment's payments its admin page lists, newest first. */
const historyLength = 20

const voider = alias(user, 'voider')

/**
 * One apartment's payments, as the committee records and voids them (R15): how it stands, the
 * months a payment can still go to (those not fully paid, up to a year ahead), and its
 * latest payments, voided ones included, with who recorded and voided each. Null when it is not
 * one of the committee's building's apartments (or the id is malformed). Uncached: it names
 * people, and a recording must see the payments as they are. The committee and up.
 */
export async function forApartment(
  apartmentId: string,
  now: Date = new Date(),
): Promise<ApartmentPayments | null> {
  const { buildingId, timeZone } = await requireRole('committee')
  // A malformed id would be a Postgres error; it is simply no apartment.
  if (!z.uuid().safeParse(apartmentId).success) return null
  try {
    const currentMonth = currentMonthIn(timeZone, now)
    const [billing, rows] = await Promise.all([
      readBilling(db, buildingId, apartmentId, currentMonth),
      db
        .select({
          id: payments.id,
          month: payments.month,
          amountAgorot: payments.amountAgorot,
          paidOn: payments.paidOn,
          method: payments.method,
          note: payments.note,
          recordedByName: user.name,
          voidedAt: payments.voidedAt,
          voidedByName: voider.name,
          voidReason: payments.voidReason,
        })
        .from(payments)
        .innerJoin(user, eq(user.id, payments.recordedBy))
        .leftJoin(voider, eq(voider.id, payments.voidedBy))
        .where(and(eq(payments.buildingId, buildingId), eq(payments.apartmentId, apartmentId)))
        .orderBy(desc(payments.month), desc(payments.createdAt), desc(payments.id))
        // One more than is shown, to know whether there are more.
        .limit(historyLength + 1),
    ])
    if (!billing) return null

    const lastMonth = addMonths(currentMonth, paymentMonthsAhead)
    return {
      number: billing.number,
      currentMonth,
      today: todayIn(timeZone, now),
      firstDay: earliestPaidOn(
        billing.apartment.billingStartMonth ?? billing.buildingBillingStartMonth,
      ),
      standing: apartmentStanding(apartmentSummary(billing)),
      lastMonth,
      openMonths: openMonths(billing, lastMonth),
      history: rows
        .slice(0, historyLength)
        .map(({ voidedAt, voidedByName, voidReason, ...payment }) => ({
          ...payment,
          // The database keeps the void columns all set or all null.
          voided:
            voidedAt && voidedByName !== null && voidReason !== null
              ? { at: voidedAt, byName: voidedByName, reason: voidReason }
              : null,
        })),
      historyLimited: rows.length > historyLength,
    }
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to load the apartment payments', {
      area: 'data/payments',
      buildingId,
      apartmentId,
      err,
    })
    throw new Error('Failed to load the apartment payments')
  }
}

// One row per apartment and month it has payments for; an apartment without any has one row
// with no month. postgres-js may return the sum as a string; it is checked to be an integer.
const boardRow = z.object({
  id: z.string(),
  number: z.string(),
  billingStartMonth: z.string().nullable(),
  month: z.string().nullable(),
  amountAgorot: z.coerce.number().int().nullable(),
})

/**
 * Every apartment of the building with what it needs to work out each month's status
 * (`utils/status`), in natural order (`byNumber`), and the current month. The apartments and
 * all their payments that count come in one query, whatever the number of apartments (no N+1);
 * the building's billing start and fee rates come from its cache.
 */
async function readBoard(buildingId: string, timeZone: string, now: Date) {
  const [{ building, rates }, rows] = await Promise.all([
    buildingBilling(buildingId),
    db
      .select({
        id: apartments.id,
        number: apartments.number,
        billingStartMonth: apartments.billingStartMonth,
        month: payments.month,
        amountAgorot: sql`cast(sum(${payments.amountAgorot}) as integer)`,
      })
      .from(apartments)
      // Voided payments never count.
      .leftJoin(
        payments,
        and(
          eq(payments.apartmentId, apartments.id),
          eq(payments.buildingId, apartments.buildingId),
          isNull(payments.voidedAt),
        ),
      )
      .where(eq(apartments.buildingId, buildingId))
      // The id is the key, so the apartment's other columns follow from it.
      .groupBy(apartments.id, payments.month)
      .orderBy(...byNumber, payments.month),
  ])
  if (!building) throw new Error(`No building ${buildingId}`)
  const currentMonth = currentMonthIn(timeZone, now)

  const board = new Map<string, ApartmentBilling & { number: string }>()
  for (const row of z.array(boardRow).parse(rows)) {
    let billing = board.get(row.id)
    if (!billing) {
      billing = {
        number: row.number,
        apartment: { id: row.id, billingStartMonth: row.billingStartMonth },
        buildingBillingStartMonth: building.billingStartMonth,
        rates,
        payments: [],
        currentMonth,
      }
      board.set(row.id, billing)
    }
    if (row.month !== null && row.amountAgorot !== null) {
      billing.payments.push({ month: row.month, amountAgorot: row.amountAgorot })
    }
  }
  return { currentMonth, buildingBillingStartMonth: building.billingStartMonth, board }
}

function arrearsOfBoard(board: Map<string, ApartmentBilling & { number: string }>): Arrears {
  return arrearsOf(
    [...board.values()].map((billing) => ({
      id: billing.apartment.id,
      number: billing.number,
      summary: apartmentSummary(billing),
    })),
  )
}

/**
 * `/admin/payments` (R17): every apartment's twelve months of the year `?year=` asks for (the
 * current year by default, kept within the years there is something to show), each with its
 * status, and who is behind. Uncached: payments are read as they are, so a recording or a void
 * shows at once. The committee and up.
 */
export async function grid(
  requestedYear: string | string[] | undefined,
  now: Date = new Date(),
): Promise<PaymentsGrid> {
  const { buildingId, timeZone } = await requireRole('committee')
  try {
    const { currentMonth, buildingBillingStartMonth, board } = await readBoard(
      buildingId,
      timeZone,
      now,
    )
    const firstBilling = [...board.values()].reduce(
      (first, { apartment }) =>
        apartment.billingStartMonth && apartment.billingStartMonth < first
          ? apartment.billingStartMonth
          : first,
      buildingBillingStartMonth,
    )
    const years = gridYears(firstBilling, currentMonth)
    const year = gridYear(requestedYear, years, Number(currentMonth.slice(0, 4)))
    const months = yearMonths(year)

    return {
      year,
      years,
      currentMonth,
      rows: [...board.values()].map((billing) => ({
        id: billing.apartment.id,
        number: billing.number,
        standing: apartmentStanding(apartmentSummary(billing)),
        months: months.map((month) => ({ month, ...monthStatus(billing, month) })),
      })),
      arrears: arrearsOfBoard(board),
    }
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to load the payments grid', { area: 'data/payments', buildingId, err })
    throw new Error('Failed to load the payments grid')
  }
}

/**
 * Who is behind and by how much (R17), the largest debt first: `/admin` opens on it. The same
 * one query as the grid. The committee and up.
 */
export async function arrears(now: Date = new Date()): Promise<Arrears> {
  const { buildingId, timeZone } = await requireRole('committee')
  try {
    const { board } = await readBoard(buildingId, timeZone, now)
    return arrearsOfBoard(board)
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to load the arrears', { area: 'data/payments', buildingId, err })
    throw new Error('Failed to load the arrears')
  }
}

const monthSumRow = z.object({ month: z.string(), amountAgorot: z.coerce.number().int() })

/**
 * `/money` (R16): how one of the person's own apartments stands, and its months (this year's,
 * after any earlier one still owed and before any later one paid ahead). Null for any apartment that is not theirs, in their
 * building. Uncached: payments are read as they are; the building's billing and fee rates
 * come from its cache. Every member.
 */
export async function monthlyStatus(
  apartmentId: string,
  now: Date = new Date(),
): Promise<ApartmentMonths | null> {
  const { buildingId, timeZone, apartmentIds } = await requireMember()
  // Only the person's own apartments; anything else (a malformed id too) is no apartment.
  if (!apartmentIds.includes(apartmentId)) return null
  try {
    const [{ building, rates }, [apartment], sums] = await Promise.all([
      buildingBilling(buildingId),
      db
        .select({
          id: apartments.id,
          number: apartments.number,
          billingStartMonth: apartments.billingStartMonth,
        })
        .from(apartments)
        .where(and(eq(apartments.id, apartmentId), eq(apartments.buildingId, buildingId))),
      // Voided payments never count.
      db
        .select({
          month: payments.month,
          amountAgorot: sql`cast(sum(${payments.amountAgorot}) as integer)`,
        })
        .from(payments)
        .where(
          and(
            eq(payments.buildingId, buildingId),
            eq(payments.apartmentId, apartmentId),
            isNull(payments.voidedAt),
          ),
        )
        .groupBy(payments.month),
    ])
    if (!building) throw new Error(`No building ${buildingId}`)
    if (!apartment) return null

    const billing: ApartmentBilling = {
      apartment: { id: apartment.id, billingStartMonth: apartment.billingStartMonth },
      buildingBillingStartMonth: building.billingStartMonth,
      rates,
      payments: z.array(monthSumRow).parse(sums),
      currentMonth: currentMonthIn(timeZone, now),
    }
    return {
      number: apartment.number,
      currentMonth: billing.currentMonth,
      standing: apartmentStanding(apartmentSummary(billing)),
      months: residentMonths(billing),
    }
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to load the monthly status', {
      area: 'data/payments',
      buildingId,
      apartmentId,
      err,
    })
    throw new Error('Failed to load the monthly status')
  }
}

/**
 * `/money` (R16): every payment of one of the person's own apartments, voided ones included,
 * newest first: by the day it was paid, then its month, then the latest recorded, then its id,
 * so the order never depends on chance. In full: about twelve a year. Never who recorded or
 * voided a payment, nor the committee's note. Null for any apartment that is not theirs, in
 * their building. Every member.
 */
export async function history(apartmentId: string): Promise<ResidentPayment[] | null> {
  const { buildingId, apartmentIds } = await requireMember()
  if (!apartmentIds.includes(apartmentId)) return null
  try {
    // The apartment is read too, so one outside the building is told from one never paid for.
    const [[apartment], rows] = await Promise.all([
      db
        .select({ id: apartments.id })
        .from(apartments)
        .where(and(eq(apartments.id, apartmentId), eq(apartments.buildingId, buildingId))),
      db
        .select({
          id: payments.id,
          month: payments.month,
          amountAgorot: payments.amountAgorot,
          paidOn: payments.paidOn,
          method: payments.method,
          voidedAt: payments.voidedAt,
          voidReason: payments.voidReason,
        })
        .from(payments)
        .where(and(eq(payments.buildingId, buildingId), eq(payments.apartmentId, apartmentId)))
        .orderBy(
          desc(payments.paidOn),
          desc(payments.month),
          desc(payments.createdAt),
          desc(payments.id),
        ),
    ])
    if (!apartment) return null

    return rows.map(({ voidedAt, voidReason, ...payment }) => ({
      ...payment,
      // The database keeps the void columns all set or all null.
      voided: voidedAt && voidReason !== null ? { at: voidedAt, reason: voidReason } : null,
    }))
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to load the payment history', {
      area: 'data/payments',
      buildingId,
      apartmentId,
      err,
    })
    throw new Error('Failed to load the payment history')
  }
}
