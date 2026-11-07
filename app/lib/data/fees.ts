import 'server-only'
import { and, eq, isNull, or } from 'drizzle-orm'
import { unstable_rethrow } from 'next/navigation'
import { z } from 'zod'
import { requireRole } from '@/app/lib/authz'
import { byNumber } from '@/app/lib/data/apartments'
import { db } from '@/app/lib/db'
import type {
  ApartmentFees,
  BuildingFeePeriod,
  FeePeriod,
  FeeSchedule,
} from '@/app/lib/definitions'
import { logger } from '@/app/lib/logger'
import { apartments, buildings, feeRates, user } from '@/app/lib/schema'
import { currentMonthIn } from '@/app/lib/utils/dates'
import { feeInForce, feePeriods } from '@/app/lib/utils/fees'

// Not cached: the history names who set each fee, and only the committee reads it, on these
// pages alone. What every member reads, the rates themselves, is cached with the building's
// billing (`data/payments`).

/** A rate with who set it, as the history shows it. */
const rateColumns = {
  id: feeRates.id,
  apartmentId: feeRates.apartmentId,
  amountAgorot: feeRates.amountAgorot,
  effectiveFrom: feeRates.effectiveFrom,
  setByName: user.name,
  setAt: feeRates.createdAt,
}

type RateRow = Omit<FeePeriod, 'until' | 'state'> & { apartmentId: string | null }

/** A building default's period: the database allows no default without an amount. */
const hasAmount = (period: FeePeriod): period is BuildingFeePeriod => period.amountAgorot !== null

/** One kind's rates as the periods they cover, newest first, without the apartment. */
function periodsOf(rows: RateRow[], currentMonth: string): FeePeriod[] {
  return feePeriods(rows, currentMonth).map(
    ({ id, amountAgorot, effectiveFrom, until, state, setByName, setAt }) => ({
      id,
      amountAgorot,
      effectiveFrom,
      until,
      state,
      setByName,
      setAt,
    }),
  )
}

/**
 * The fees of the committee's building (R14): its default's history and that of every
 * apartment with a fee of its own, and the apartments to choose from. Three queries sent
 * together. The committee and up: anyone else gets a 404.
 */
export async function list(now: Date = new Date()): Promise<FeeSchedule> {
  const { buildingId, timeZone } = await requireRole('committee')
  try {
    const [[building], rates, choices] = await Promise.all([
      db
        .select({ billingStartMonth: buildings.billingStartMonth })
        .from(buildings)
        .where(eq(buildings.id, buildingId)),
      db
        .select(rateColumns)
        .from(feeRates)
        .innerJoin(user, eq(user.id, feeRates.createdBy))
        .where(eq(feeRates.buildingId, buildingId)),
      db
        .select({ id: apartments.id, number: apartments.number })
        .from(apartments)
        .where(eq(apartments.buildingId, buildingId))
        .orderBy(...byNumber),
    ])
    if (!building) throw new Error(`No building ${buildingId}`)

    const currentMonth = currentMonthIn(timeZone, now)
    const byApartment = Map.groupBy(rates, (rate) => rate.apartmentId)
    return {
      currentMonth,
      billingStartMonth: building.billingStartMonth,
      building: periodsOf(byApartment.get(null) ?? [], currentMonth).filter(hasAmount),
      // In the choices' natural order.
      apartments: choices.flatMap((apartment) => {
        const own = byApartment.get(apartment.id)
        return own ? [{ apartment, periods: periodsOf(own, currentMonth) }] : []
      }),
      choices,
    }
  } catch (err) {
    // Next's own signals (such as a prerender that ended) are not failures.
    unstable_rethrow(err)
    logger.error('Failed to load the fees', { area: 'data/fees', buildingId, err })
    throw new Error('Failed to load the fees')
  }
}

/**
 * One apartment's fee (R14): what it pays this month and whose fee that is, its own fees'
 * history, and the building's next fee when it will pay that one. Null when it is not one of
 * the committee's building's apartments (or the id is malformed). The committee and up.
 */
export async function forApartment(
  apartmentId: string,
  now: Date = new Date(),
): Promise<ApartmentFees | null> {
  const { buildingId, timeZone } = await requireRole('committee')
  // A malformed id would be a Postgres error; it is simply no apartment.
  if (!z.uuid().safeParse(apartmentId).success) return null
  try {
    const [[apartment], rates] = await Promise.all([
      db
        .select({ id: apartments.id })
        .from(apartments)
        .where(and(eq(apartments.id, apartmentId), eq(apartments.buildingId, buildingId))),
      // The building's default and this apartment's own, which a scoped id keeps in the building.
      db
        .select(rateColumns)
        .from(feeRates)
        .innerJoin(user, eq(user.id, feeRates.createdBy))
        .where(
          and(
            eq(feeRates.buildingId, buildingId),
            or(isNull(feeRates.apartmentId), eq(feeRates.apartmentId, apartmentId)),
          ),
        ),
    ])
    if (!apartment) return null

    const currentMonth = currentMonthIn(timeZone, now)
    const nextBuildingFee = periodsOf(
      rates.filter((rate) => rate.apartmentId === null),
      currentMonth,
    )
      .filter(hasAmount)
      // Newest first, so the last upcoming one is the next to start.
      .findLast((period) => period.state === 'upcoming')
    // Shown only when the apartment will pay it: not when its own fee starts first.
    const paysNext =
      nextBuildingFee &&
      feeInForce(rates, apartmentId, nextBuildingFee.effectiveFrom)?.source === 'building'
    return {
      currentMonth,
      inForce: feeInForce(rates, apartmentId, currentMonth),
      periods: periodsOf(
        rates.filter((rate) => rate.apartmentId === apartmentId),
        currentMonth,
      ),
      upcomingBuildingFee: paysNext
        ? {
            amountAgorot: nextBuildingFee.amountAgorot,
            effectiveFrom: nextBuildingFee.effectiveFrom,
          }
        : null,
    }
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to load the apartment fee', {
      area: 'data/fees',
      buildingId,
      apartmentId,
      err,
    })
    throw new Error('Failed to load the apartment fee')
  }
}
