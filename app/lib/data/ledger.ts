import 'server-only'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { z } from 'zod'
import { requireMember } from '@/app/lib/authz'
import { balanceTag, buildingTag } from '@/app/lib/data/cache-tags'
import { db } from '@/app/lib/db'
import type { BuildingBalance, LedgerYear } from '@/app/lib/definitions'
import { logger } from '@/app/lib/logger'
import { ledgerRange, ledgerYear } from '@/app/lib/data/ledger-year'
import { balanceAdjustments, buildings, expenses, payments } from '@/app/lib/schema'
import { currentMonthIn } from '@/app/lib/utils/dates'
import { balance as computeBalance } from '@/app/lib/utils/ledger'
import { gridYear } from '@/app/lib/utils/payments'

// A building's lifetime sums can outgrow a 32-bit integer, so they are bigint, which
// postgres-js returns as a string; each is parsed back to a safe integer.
const agorot = z.coerce.number().int()
const balanceRow = z.object({
  openingBalanceAgorot: agorot,
  adjustmentsAgorot: agorot,
  paymentsAgorot: agorot,
  expensesAgorot: agorot,
})

/**
 * The building fund: its parts and the total, in one query of correlated subqueries. The same
 * for every member, so it is cached per building until a write to its money updates the tag.
 */
export async function balance(buildingId: string): Promise<BuildingBalance> {
  'use cache'
  cacheTag(buildingTag(buildingId), balanceTag(buildingId))
  cacheLife('hours')
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
    // Next's own signals (such as a prerender that ended) are not failures.
    unstable_rethrow(err)
    logger.error('Failed to load the balance', { area: 'data/ledger', buildingId, err })
    throw new Error('Failed to load the balance')
  }
}

/**
 * One year of the member's building's fund (R19), the one `?year=` names (this year by
 * default, kept within the years there is something to show): what came in, what went out
 * by category and month, the corrections, and the expenses themselves with their receipts.
 * Voided payments and expenses do not count, and residents see only those that do. Every
 * member; the same for each of them, so it is cached per building and year like the balance.
 * Only the year it is clamped to keys the cache, never what the visitor typed.
 */
export async function yearReport(
  requestedYear: string | string[] | undefined,
  now: Date = new Date(),
): Promise<LedgerYear> {
  const { buildingId, timeZone } = await requireMember()
  const currentMonth = currentMonthIn(timeZone, now)
  const currentYear = Number(currentMonth.slice(0, 4))
  const { billingStartMonth, years } = await ledgerRange(buildingId, timeZone, currentYear)
  const year = gridYear(requestedYear, years, currentYear)
  const report = await ledgerYear(buildingId, timeZone, year, billingStartMonth, currentMonth)
  return { ...report, years }
}
