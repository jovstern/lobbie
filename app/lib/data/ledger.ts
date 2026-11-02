import 'server-only'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/app/lib/db'
import type { BuildingBalance } from '@/app/lib/definitions'
import { logger } from '@/app/lib/logger'
import { balanceAdjustments, buildings, expenses, payments } from '@/app/lib/schema'
import { balance as computeBalance } from '@/app/lib/utils/ledger'

// A building's lifetime sums can outgrow a 32-bit integer, so they are bigint, which
// postgres-js returns as a string; each is parsed back to a safe integer.
const agorot = z.coerce.number().int()
const balanceRow = z.object({
  openingBalanceAgorot: agorot,
  adjustmentsAgorot: agorot,
  paymentsAgorot: agorot,
  expensesAgorot: agorot,
})

/** The building fund: its parts and the total, in one query of correlated subqueries. */
export async function balance(buildingId: string): Promise<BuildingBalance> {
  try {
    const [row] = await db
      .select({
        openingBalanceAgorot: buildings.openingBalanceAgorot,
        adjustmentsAgorot: sql`(
          SELECT cast(coalesce(sum(${balanceAdjustments.amountAgorot}), 0) as bigint)
          FROM ${balanceAdjustments}
          WHERE ${eq(balanceAdjustments.buildingId, buildings.id)}
        )`,
        paymentsAgorot: sql`(
          SELECT cast(coalesce(sum(${payments.amountAgorot}), 0) as bigint)
          FROM ${payments}
          WHERE ${and(eq(payments.buildingId, buildings.id), isNull(payments.voidedAt))}
        )`,
        expensesAgorot: sql`(
          SELECT cast(coalesce(sum(${expenses.amountAgorot}), 0) as bigint)
          FROM ${expenses}
          WHERE ${and(eq(expenses.buildingId, buildings.id), isNull(expenses.voidedAt))}
        )`,
      })
      .from(buildings)
      .where(eq(buildings.id, buildingId))
    if (!row) throw new Error(`No building ${buildingId}`)
    const parts = balanceRow.parse(row)
    return { ...parts, totalAgorot: computeBalance(parts) }
  } catch (err) {
    logger.error('Failed to load the balance', { area: 'data/ledger', buildingId, err })
    throw new Error('Failed to load the balance')
  }
}
