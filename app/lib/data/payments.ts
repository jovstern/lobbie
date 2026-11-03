import 'server-only'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { z } from 'zod'
import { buildingTag, feesTag } from '@/app/lib/data/cache-tags'
import { db } from '@/app/lib/db'
import type { ApartmentStatus } from '@/app/lib/definitions'
import { logger } from '@/app/lib/logger'
import { apartments, buildings, feeRates, payments } from '@/app/lib/schema'
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

// The asked apartments' own rows: never cached, since they belong to particular people.
function apartmentBilling(buildingId: string, apartmentIds: string[]) {
  return Promise.all([
    db
      .select({
        id: apartments.id,
        number: apartments.number,
        billingStartMonth: apartments.billingStartMonth,
      })
      .from(apartments)
      .where(and(eq(apartments.buildingId, buildingId), inArray(apartments.id, apartmentIds))),
    db
      .select({
        apartmentId: payments.apartmentId,
        month: payments.month,
        amountAgorot: sql`cast(sum(${payments.amountAgorot}) as integer)`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.buildingId, buildingId),
          inArray(payments.apartmentId, apartmentIds),
          isNull(payments.voidedAt),
        ),
      )
      .groupBy(payments.apartmentId, payments.month),
  ])
}

/**
 * What each apartment owes, with its number, keyed by apartment id in the order asked. Ids
 * that are not apartments of this building are left out. The building's part comes from the
 * cache; the apartments and their payments are read together, in one round trip.
 */
export async function statusForApartments(
  buildingId: string,
  apartmentIds: string[],
  now: Date = new Date(),
): Promise<Map<string, ApartmentStatus>> {
  if (apartmentIds.length === 0) return new Map()
  try {
    const [{ building, rates }, [apartmentRows, paymentRows]] = await Promise.all([
      buildingBilling(buildingId),
      apartmentBilling(buildingId, apartmentIds),
    ])
    if (!building) throw new Error(`No building ${buildingId}`)
    const paymentsByApartment = Map.groupBy(
      z.array(monthPaymentRow).parse(paymentRows),
      (payment) => payment.apartmentId,
    )
    const currentMonth = currentMonthIn(building.timezone, now)

    const rowsById = new Map(apartmentRows.map((apartment) => [apartment.id, apartment]))

    return new Map(
      apartmentIds.flatMap((id) => {
        const apartment = rowsById.get(id)
        if (!apartment) return []
        const summary = apartmentSummary({
          apartment,
          buildingBillingStartMonth: building.billingStartMonth,
          rates,
          payments: paymentsByApartment.get(apartment.id) ?? [],
          currentMonth,
        })
        return [[id, { number: apartment.number, ...summary }]]
      }),
    )
  } catch (err) {
    logger.error('Failed to load payment statuses', { area: 'data/payments', buildingId, err })
    throw new Error('Failed to load payment statuses')
  }
}
