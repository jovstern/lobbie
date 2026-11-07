import 'server-only'
import { and, between, desc, eq, isNull, sql } from 'drizzle-orm'
import { type AnyPgColumn, unionAll } from 'drizzle-orm/pg-core'
import { cacheLife, cacheTag } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { z } from 'zod'
import { balanceTag, buildingTag } from '@/app/lib/data/cache-tags'
import { db } from '@/app/lib/db'
import type { LedgerYear, YearRange } from '@/app/lib/definitions'
import { logger } from '@/app/lib/logger'
import {
  balanceAdjustments,
  buildings,
  expenseCategoryEnum,
  expenses,
  payments,
} from '@/app/lib/schema'
import { ledgerYears, yearFigures } from '@/app/lib/utils/ledger'

// The cached reads behind `yearReport` (data/ledger.ts), apart so that what keys each cache
// entry is plain to see and to test: never what a visitor typed, only the building, its time
// zone and a year within its range. The callers authorize; these read any building.

const agorot = z.coerce.number().int()

const rangeRow = z.object({
  billingStartMonth: z.string(),
  earliestPaidOn: z.string().nullable(),
  earliestSpentOn: z.string().nullable(),
  earliestAdjustedOn: z.string().nullable(),
})

const sumRow = z.object({ month: z.string(), amountAgorot: agorot })
const ledgerRow = z.discriminatedUnion('kind', [
  sumRow.extend({ kind: z.enum(['payment', 'adjustment']), category: z.null() }),
  sumRow.extend({ kind: z.literal('expense'), category: z.enum(expenseCategoryEnum.enumValues) }),
])

/** A correction is a moment; its day is the one it was in the building's time zone. */
const adjustedOn = (timeZone: string) =>
  sql`(${balanceAdjustments.createdAt} AT TIME ZONE ${timeZone})::date`

/**
 * The years a building's fund has something to show, up to `currentYear`, and its billing start:
 * one query. Cached per building, time zone and year, until a write to its money.
 */
export async function ledgerRange(
  buildingId: string,
  timeZone: string,
  currentYear: number,
): Promise<{ billingStartMonth: string; years: YearRange }> {
  'use cache'
  cacheTag(buildingTag(buildingId), balanceTag(buildingId))
  cacheLife('hours')
  try {
    const [start] = await db
      .select({
        billingStartMonth: buildings.billingStartMonth,
        earliestPaidOn: sql`(
          SELECT min(${payments.paidOn})::text FROM ${payments}
          WHERE ${and(eq(payments.buildingId, buildings.id), isNull(payments.voidedAt))}
        )`,
        earliestSpentOn: sql`(
          SELECT min(${expenses.spentOn})::text FROM ${expenses}
          WHERE ${and(eq(expenses.buildingId, buildings.id), isNull(expenses.voidedAt))}
        )`,
        earliestAdjustedOn: sql`(
          SELECT min(${adjustedOn(timeZone)})::text FROM ${balanceAdjustments}
          WHERE ${eq(balanceAdjustments.buildingId, buildings.id)}
        )`,
      })
      .from(buildings)
      .where(eq(buildings.id, buildingId))
    if (!start) throw new Error(`No building ${buildingId}`)
    const dates = rangeRow.parse(start)
    return {
      billingStartMonth: dates.billingStartMonth,
      years: ledgerYears(dates, currentYear),
    }
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to load the years', { area: 'data/ledger', buildingId, err })
    throw new Error('Failed to load the year')
  }
}

/**
 * One year of a building's fund: the sums by kind, category and month, and the expenses that
 * count, in two queries at once. `year` must already be one of `ledgerRange`'s years, so the
 * cache holds an entry per year there is something to show, however `?year=` is set.
 */
export async function ledgerYear(
  buildingId: string,
  timeZone: string,
  year: number,
  billingStartMonth: string,
  currentMonth: string,
): Promise<Omit<LedgerYear, 'years'>> {
  'use cache'
  cacheTag(buildingTag(buildingId), balanceTag(buildingId))
  cacheLife('hours')
  const adjusted = adjustedOn(timeZone)
  const [from, to] = [`${year}-01-01`, `${year}-12-31`]
  try {
    // Grouped by position, since the time zone is a parameter, and a repeated parameter is a
    // different expression to Postgres.
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
            month: sql`to_char(${adjusted}, 'YYYY-MM')`.as('month'),
            amountAgorot: sum(balanceAdjustments.amountAgorot),
          })
          .from(balanceAdjustments)
          .where(
            and(
              eq(balanceAdjustments.buildingId, buildingId),
              sql`${adjusted} BETWEEN ${from} AND ${to}`,
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
      ...yearFigures(z.array(ledgerRow).parse(sums), { year, billingStartMonth, currentMonth }),
      expenses: listed,
    }
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to load the year', { area: 'data/ledger', buildingId, err })
    throw new Error('Failed to load the year')
  }
}
