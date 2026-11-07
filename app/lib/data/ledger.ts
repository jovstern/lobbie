import 'server-only'
import { and, between, desc, eq, isNull, sql } from 'drizzle-orm'
import { type AnyPgColumn, unionAll } from 'drizzle-orm/pg-core'
import { cacheLife, cacheTag } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { z } from 'zod'
import { requireMember } from '@/app/lib/authz'
import { balanceTag, buildingTag } from '@/app/lib/data/cache-tags'
import { db } from '@/app/lib/db'
import type { BuildingBalance, LedgerYear } from '@/app/lib/definitions'
import { logger } from '@/app/lib/logger'
import {
  balanceAdjustments,
  buildings,
  expenseCategoryEnum,
  expenses,
  payments,
} from '@/app/lib/schema'
import { currentMonthIn } from '@/app/lib/utils/dates'
import { balance as computeBalance, ledgerYears, yearFigures } from '@/app/lib/utils/ledger'
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

const yearStartRow = z.object({
  billingStartMonth: z.string(),
  earliestPaidOn: z.string().nullable(),
  earliestAdjustedOn: z.string().nullable(),
})

const sumRow = z.object({ month: z.string(), amountAgorot: agorot })
const ledgerRow = z.discriminatedUnion('kind', [
  sumRow.extend({ kind: z.enum(['payment', 'adjustment']), category: z.null() }),
  sumRow.extend({ kind: z.literal('expense'), category: z.enum(expenseCategoryEnum.enumValues) }),
])

/**
 * One year of the member's building's fund (R19), the one `?year=` names (this year by
 * default, kept within the years there is something to show): what came in, what went out
 * by category and month, the corrections, and the expenses themselves with their receipts.
 * Voided payments and expenses do not count, and residents see only those that do. Every
 * member; the same for each of them, so it is cached per building and year like the balance.
 */
export async function yearReport(
  requestedYear: string | string[] | undefined,
  now: Date = new Date(),
): Promise<LedgerYear> {
  const { buildingId, timeZone } = await requireMember()
  // Only a year keys the cache: anything else reads as this year, so it shares this year's entry.
  const isYear = typeof requestedYear === 'string' && /^[1-9]\d{3}$/.test(requestedYear)
  return readYear(
    buildingId,
    timeZone,
    isYear ? requestedYear : null,
    currentMonthIn(timeZone, now),
  )
}

async function readYear(
  buildingId: string,
  timeZone: string,
  requestedYear: string | null,
  currentMonth: string,
): Promise<LedgerYear> {
  'use cache'
  cacheTag(buildingTag(buildingId), balanceTag(buildingId))
  cacheLife('hours')
  // A correction is a moment; its day is the one it was in the building's time zone.
  const adjustedOn = sql`(${balanceAdjustments.createdAt} AT TIME ZONE ${timeZone})::date`
  try {
    const [start] = await db
      .select({
        billingStartMonth: buildings.billingStartMonth,
        earliestPaidOn: sql`(
          SELECT min(${payments.paidOn})::text FROM ${payments}
          WHERE ${and(eq(payments.buildingId, buildings.id), isNull(payments.voidedAt))}
        )`,
        earliestAdjustedOn: sql`(
          SELECT min(${adjustedOn})::text FROM ${balanceAdjustments}
          WHERE ${eq(balanceAdjustments.buildingId, buildings.id)}
        )`,
      })
      .from(buildings)
      .where(eq(buildings.id, buildingId))
    if (!start) throw new Error(`No building ${buildingId}`)
    const { billingStartMonth, ...earliest } = yearStartRow.parse(start)
    const currentYear = Number(currentMonth.slice(0, 4))
    const years = ledgerYears({ billingStartMonth, ...earliest }, currentYear)
    const year = gridYear(requestedYear ?? undefined, years, currentYear)
    const [from, to] = [`${year}-01-01`, `${year}-12-31`]

    // The sums by kind, category and month in one query; grouped by position, since the time
    // zone is a parameter, and a repeated parameter is a different expression to Postgres.
    const sum = (amount: AnyPgColumn) => sql`cast(sum(${amount}) as bigint)`.as('amount_agorot')
    const [sums, listed] = await Promise.all([
      unionAll(
        db
          .select({
            kind: sql`'payment'`.as('kind'),
            category: sql`null::text`.as('category'),
            month: sql`to_char(${payments.paidOn}, 'YYYY-MM')`.as('month'),
            amountAgorot: sum(payments.amountAgorot),
          })
          .from(payments)
          .where(
            and(
              eq(payments.buildingId, buildingId),
              isNull(payments.voidedAt),
              between(payments.paidOn, from, to),
            ),
          )
          .groupBy(sql`1, 2, 3`),
        db
          .select({
            kind: sql`'expense'`.as('kind'),
            category: sql`${expenses.category}::text`.as('category'),
            month: sql`to_char(${expenses.spentOn}, 'YYYY-MM')`.as('month'),
            amountAgorot: sum(expenses.amountAgorot),
          })
          .from(expenses)
          .where(
            and(
              eq(expenses.buildingId, buildingId),
              isNull(expenses.voidedAt),
              between(expenses.spentOn, from, to),
            ),
          )
          .groupBy(sql`1, 2, 3`),
        db
          .select({
            kind: sql`'adjustment'`.as('kind'),
            category: sql`null::text`.as('category'),
            month: sql`to_char(${adjustedOn}, 'YYYY-MM')`.as('month'),
            amountAgorot: sum(balanceAdjustments.amountAgorot),
          })
          .from(balanceAdjustments)
          .where(
            and(
              eq(balanceAdjustments.buildingId, buildingId),
              sql`${adjustedOn} BETWEEN ${from} AND ${to}`,
            ),
          )
          .groupBy(sql`1, 2, 3`),
      ),
      db
        .select({
          id: expenses.id,
          category: expenses.category,
          amountAgorot: expenses.amountAgorot,
          spentOn: expenses.spentOn,
          description: expenses.description,
          receiptKey: expenses.receiptKey,
        })
        .from(expenses)
        .where(
          and(
            eq(expenses.buildingId, buildingId),
            isNull(expenses.voidedAt),
            between(expenses.spentOn, from, to),
          ),
        )
        .orderBy(desc(expenses.spentOn), desc(expenses.createdAt), desc(expenses.id)),
    ])

    return {
      year,
      years,
      ...yearFigures(z.array(ledgerRow).parse(sums), { year, billingStartMonth, currentMonth }),
      expenses: listed,
    }
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to load the year', { area: 'data/ledger', buildingId, err })
    throw new Error('Failed to load the year')
  }
}
