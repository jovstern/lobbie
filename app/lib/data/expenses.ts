import 'server-only'
import { and, between, desc, eq, min } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { unstable_rethrow } from 'next/navigation'
import { getMembership, requireRole } from '@/app/lib/authz'
import { db } from '@/app/lib/db'
import type { AdminExpenses } from '@/app/lib/definitions'
import { logger } from '@/app/lib/logger'
import { buildings, expenses, user } from '@/app/lib/schema'
import { todayIn } from '@/app/lib/utils/dates'
import { earliestSpentOn, ledgerYears } from '@/app/lib/utils/ledger'
import { gridYear } from '@/app/lib/utils/payments'
import { isReceiptKey } from '@/app/lib/utils/receipt-file'

const voider = alias(user, 'voider')

/** One year of a building's expenses, newest first, with who recorded and voided each. */
function expensesOf(buildingId: string, year: number) {
  return db
    .select({
      id: expenses.id,
      category: expenses.category,
      amountAgorot: expenses.amountAgorot,
      spentOn: expenses.spentOn,
      description: expenses.description,
      receiptKey: expenses.receiptKey,
      recordedByName: user.name,
      voidedAt: expenses.voidedAt,
      voidedByName: voider.name,
      voidReason: expenses.voidReason,
    })
    .from(expenses)
    .innerJoin(user, eq(user.id, expenses.recordedBy))
    .leftJoin(voider, eq(voider.id, expenses.voidedBy))
    .where(
      and(
        eq(expenses.buildingId, buildingId),
        between(expenses.spentOn, `${year}-01-01`, `${year}-12-31`),
      ),
    )
    .orderBy(desc(expenses.spentOn), desc(expenses.createdAt), desc(expenses.id))
}

/**
 * One year of the committee's building's expenses (R18; `?year=`, this year by default, kept
 * within the years there are), newest first, voided ones included, with who recorded and
 * voided each, and the dates a new one may carry. Uncached: it names people, and a recording
 * must see the list as it is. The committee and up. A year at a time keeps the page small as
 * the years add up.
 */
export async function list(requestedYear?: string | string[]): Promise<AdminExpenses> {
  const { buildingId, timeZone } = await requireRole('committee')
  const today = todayIn(timeZone)
  const currentYear = Number(today.slice(0, 4))
  // Read with the range, not after it: only a year before the first one needs a second read.
  const asked = gridYear(requestedYear, { first: 0, last: currentYear }, currentYear)
  try {
    const [[building], [earliest], askedRows] = await Promise.all([
      db
        .select({ billingStartMonth: buildings.billingStartMonth })
        .from(buildings)
        .where(eq(buildings.id, buildingId)),
      db
        .select({ spentOn: min(expenses.spentOn) })
        .from(expenses)
        .where(eq(expenses.buildingId, buildingId)),
      expensesOf(buildingId, asked),
    ])
    if (!building) throw new Error(`No building ${buildingId}`)
    const years = ledgerYears(
      {
        billingStartMonth: building.billingStartMonth,
        earliestPaidOn: null,
        earliestSpentOn: earliest?.spentOn ?? null,
        earliestAdjustedOn: null,
      },
      currentYear,
    )
    const year = Math.max(asked, years.first)
    const rows = year === asked ? askedRows : await expensesOf(buildingId, year)

    return {
      year,
      years,
      today,
      firstDay: earliestSpentOn(building.billingStartMonth),
      expenses: rows.map(({ voidedAt, voidedByName, voidReason, ...expense }) => ({
        ...expense,
        // The database keeps the void columns all set or all null.
        voided:
          voidedAt && voidedByName !== null && voidReason !== null
            ? { at: voidedAt, byName: voidedByName, reason: voidReason }
            : null,
      })),
    }
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to load the expenses', { area: 'data/expenses', buildingId, err })
    throw new Error('Failed to load the expenses')
  }
}

/**
 * The expense a receipt belongs to, when the person asking may open it: any member of that
 * expense's building (R19), whether or not it was voided. Null for everyone else (signed out,
 * without a building, another building's member) and for a key no expense of theirs names, so
 * the Route Handler answers all of them alike, with a 404.
 */
export async function receipt(key: string): Promise<{ spentOn: string } | null> {
  if (!isReceiptKey(key)) return null
  const membership = await getMembership()
  if (membership.status !== 'member') return null
  const { buildingId } = membership.member
  try {
    const [row] = await db
      .select({ spentOn: expenses.spentOn })
      .from(expenses)
      .where(and(eq(expenses.buildingId, buildingId), eq(expenses.receiptKey, key)))
    return row ?? null
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to load the receipt', { area: 'data/expenses', buildingId, err })
    throw new Error('Failed to load the receipt')
  }
}
