import 'server-only'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { z } from 'zod'
import { buildingTag, feesTag } from '@/app/lib/data/cache-tags'
import { db } from '@/app/lib/db'
import type { ApartmentStatus } from '@/app/lib/definitions'
import { logger } from '@/app/lib/logger'
import {
  apartmentResidents,
  apartments,
  buildingMembers,
  buildings,
  feeRates,
  payments,
} from '@/app/lib/schema'
import { currentMonthIn } from '@/app/lib/utils/dates'
import { apartmentSummary } from '@/app/lib/utils/status'

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
    logger.error('Failed to load payment statuses', { area: 'data/payments', userId, err })
    throw new Error('Failed to load payment statuses')
  }
}
