import 'server-only'
import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Tx } from '@/app/lib/admin-guard'
import type { Db } from '@/app/lib/db'
import { apartments, buildings, feeRates, payments } from '@/app/lib/schema'
import type { ApartmentBilling } from '@/app/lib/utils/status'

// postgres-js returns some numeric results as strings; the sum is checked to be an integer.
const monthSum = z.object({ month: z.string(), amountAgorot: z.coerce.number().int() })

/**
 * Everything needed to work out what one apartment owes (`utils/status`), read fresh, not from
 * the building's cache: recording a payment checks it inside its transaction, after locking the
 * apartment, so a payment committed meanwhile is counted. Four queries sent together, each
 * scoped to the building. Null when the apartment is not one of the building's.
 */
export async function readBilling(
  executor: Db | Tx,
  buildingId: string,
  apartmentId: string,
  currentMonth: string,
): Promise<(ApartmentBilling & { number: string }) | null> {
  const [[apartment], [building], rates, sums] = await Promise.all([
    executor
      .select({
        id: apartments.id,
        number: apartments.number,
        billingStartMonth: apartments.billingStartMonth,
      })
      .from(apartments)
      .where(and(eq(apartments.id, apartmentId), eq(apartments.buildingId, buildingId))),
    executor
      .select({ billingStartMonth: buildings.billingStartMonth })
      .from(buildings)
      .where(eq(buildings.id, buildingId)),
    // The building's default and this apartment's own.
    executor
      .select({
        apartmentId: feeRates.apartmentId,
        amountAgorot: feeRates.amountAgorot,
        effectiveFrom: feeRates.effectiveFrom,
      })
      .from(feeRates)
      .where(
        and(
          eq(feeRates.buildingId, buildingId),
          or(isNull(feeRates.apartmentId), eq(feeRates.apartmentId, apartmentId)),
        ),
      ),
    // Voided payments never count.
    executor
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
  if (!apartment || !building) return null
  return {
    number: apartment.number,
    apartment: { id: apartment.id, billingStartMonth: apartment.billingStartMonth },
    buildingBillingStartMonth: building.billingStartMonth,
    rates,
    payments: z.array(monthSum).parse(sums),
    currentMonth,
  }
}
