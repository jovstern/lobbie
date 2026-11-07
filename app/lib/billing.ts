import 'server-only'
import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Tx } from '@/app/lib/admin-guard'
import type { Db } from '@/app/lib/db'
import { apartments, buildings, feeRates, payments } from '@/app/lib/schema'
import type { ApartmentBilling } from '@/app/lib/utils/status'

// One row: the apartment, its building's billing start, and as JSON the fee rates and the sums
// paid by month. JSON numbers come back as numbers, its dates as `YYYY-MM` text.
const billingRow = z.object({
  number: z.string(),
  billingStartMonth: z.string().nullable(),
  buildingBillingStartMonth: z.string(),
  rates: z.array(
    z.object({
      apartmentId: z.string().nullable(),
      amountAgorot: z.number().int().nullable(),
      effectiveFrom: z.string(),
    }),
  ),
  payments: z.array(z.object({ month: z.string(), amountAgorot: z.number().int() })),
})

/**
 * Everything needed to work out what one apartment owes (`utils/status`), read fresh, not from
 * the building's cache: recording a payment checks it inside its transaction, after locking the
 * apartment, so a payment committed meanwhile is counted. One query, scoped to the building, so
 * the locked apartment waits on a single round trip. Null when the apartment is not one of the
 * building's.
 */
export async function readBilling(
  executor: Db | Tx,
  buildingId: string,
  apartmentId: string,
  currentMonth: string,
): Promise<(ApartmentBilling & { number: string }) | null> {
  const [row] = await executor
    .select({
      number: apartments.number,
      billingStartMonth: apartments.billingStartMonth,
      buildingBillingStartMonth: buildings.billingStartMonth,
      // The building's default and this apartment's own.
      rates: sql`(
        SELECT coalesce(json_agg(json_build_object(
          'apartmentId', ${feeRates.apartmentId},
          'amountAgorot', ${feeRates.amountAgorot},
          'effectiveFrom', ${feeRates.effectiveFrom}
        )), '[]'::json)
        FROM ${feeRates}
        WHERE ${and(
          eq(feeRates.buildingId, buildings.id),
          or(isNull(feeRates.apartmentId), eq(feeRates.apartmentId, apartments.id)),
        )}
      )`,
      // Voided payments never count.
      payments: sql`(
        SELECT coalesce(json_agg(json_build_object('month', paid.month, 'amountAgorot', paid.amount_agorot)), '[]'::json)
        FROM (
          SELECT ${payments.month} AS month, sum(${payments.amountAgorot}) AS amount_agorot
          FROM ${payments}
          WHERE ${and(
            eq(payments.buildingId, buildings.id),
            eq(payments.apartmentId, apartments.id),
            isNull(payments.voidedAt),
          )}
          GROUP BY ${payments.month}
        ) AS paid
      )`,
    })
    .from(apartments)
    .innerJoin(buildings, eq(buildings.id, apartments.buildingId))
    .where(and(eq(apartments.id, apartmentId), eq(apartments.buildingId, buildingId)))
  if (!row) return null
  const billing = billingRow.parse(row)
  return {
    number: billing.number,
    apartment: { id: apartmentId, billingStartMonth: billing.billingStartMonth },
    buildingBillingStartMonth: billing.buildingBillingStartMonth,
    rates: billing.rates,
    payments: billing.payments,
    currentMonth,
  }
}
