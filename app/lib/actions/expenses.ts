'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { updateTag } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { demoRefusal, refreshExpensePages } from '@/app/lib/actions/shared'
import { authorizeAction } from '@/app/lib/authz'
import { buildingTag } from '@/app/lib/data/cache-tags'
import { db } from '@/app/lib/db'
import { logger } from '@/app/lib/logger'
import { buildings, expenseCategoryEnum, expenses } from '@/app/lib/schema'
import { checkFile, put, remove, type CheckedFile, type FileRefusal } from '@/app/lib/storage'
import { formatDay, isCalendarDate, todayIn } from '@/app/lib/utils/dates'
import { typed, type Translate } from '@/app/lib/utils/form'
import { earliestSpentOn } from '@/app/lib/utils/ledger'
import { parseShekelsToAgorot } from '@/app/lib/utils/money'
import { maxReceiptBytes } from '@/app/lib/utils/receipt-file'
import { resolveLocale } from '@/i18n/locale'

const area = 'actions/expenses'
const route = '/admin/expenses'

type ExpenseField = 'category' | 'amount' | 'spentOn' | 'description' | 'receipt'

function expenseSchema(t: Translate<'ExpenseErrors'>, today: string) {
  return z.object({
    category: z.enum(expenseCategoryEnum.enumValues, { error: t('category') }),
    amount: z.string({ error: t('amount') }).transform((value, ctx) => {
      const agorot = parseShekelsToAgorot(value)
      // An expense of zero is no expense, and the database refuses it too.
      if (agorot === null || agorot === 0) {
        ctx.addIssue({ code: 'custom', message: t('amount') })
        return z.NEVER
      }
      return agorot
    }),
    spentOn: z
      .string({ error: t('spentOn') })
      .refine(isCalendarDate, t('spentOn'))
      // Dates as `YYYY-MM-DD` compare as strings.
      .refine((date) => date <= today, t('spentOnFuture')),
    description: z.string().trim().min(2, t('description')).max(200, t('description')),
  })
}

export type ExpenseFormState = {
  /** What the fields held, after an error; a file cannot be given back, only its name. */
  values?: {
    category: string
    amount: string
    spentOn: string
    description: string
    receiptName: string
  }
  errors?: Partial<Record<ExpenseField, string[]>>
  message?: string | null
  /** Set once the expense is recorded; the form says what was added and empties. */
  recorded?: { description: string; amountAgorot: number }
}

const refusalMessage: Record<FileRefusal, 'receiptEmpty' | 'receiptTooLarge' | 'receiptType'> = {
  empty: 'receiptEmpty',
  tooLarge: 'receiptTooLarge',
  type: 'receiptType',
}

/**
 * The receipt sent with the form, checked by its bytes (spec §3): none when no file was
 * chosen (browsers then send an empty, nameless file). One over 4 MB is refused unread.
 */
async function readReceipt(
  value: FormDataEntryValue | null,
): Promise<{ ok: true; file: CheckedFile | null } | { ok: false; reason: FileRefusal }> {
  if (!(value instanceof File) || (value.size === 0 && value.name === '')) {
    return { ok: true, file: null }
  }
  if (value.size > maxReceiptBytes) return { ok: false, reason: 'tooLarge' }
  return checkFile(new Uint8Array(await value.arrayBuffer()))
}

/** Removes a receipt whose expense was never saved, so no file is left that nothing names. */
async function removeOrphan(key: string, buildingId: string) {
  try {
    await remove(key)
  } catch (err) {
    logger.error('Failed to remove the receipt of an unsaved expense', {
      area,
      route,
      buildingId,
      key,
      err,
    })
  }
}

/**
 * Records an expense (R18) with its receipt, if one is attached: the committee and up, for
 * their building. The receipt is stored first, then the row that names it; if the row cannot
 * be saved, the file is removed again. The expense comes off the building fund, whose cached
 * balance is refreshed.
 */
export async function record(
  locale: string,
  _prevState: ExpenseFormState,
  formData: FormData,
): Promise<ExpenseFormState> {
  const lang = resolveLocale(locale)
  const receiptValue = formData.get('receipt')
  const values = {
    category: typed(formData, 'category'),
    amount: typed(formData, 'amount'),
    spentOn: typed(formData, 'spentOn'),
    description: typed(formData, 'description'),
    receiptName: receiptValue instanceof File ? receiptValue.name : '',
  }

  const authorization = await authorizeAction('committee', lang)
  if (!authorization.ok) return { values, message: authorization.message }
  const { member } = authorization

  const t = await getTranslations({ locale: lang, namespace: 'ExpenseErrors' })
  const [validatedFields, receipt] = await Promise.all([
    expenseSchema(t, todayIn(member.timeZone)).safeParse(values),
    readReceipt(receiptValue),
  ])
  if (!validatedFields.success || !receipt.ok) {
    const errors: ExpenseFormState['errors'] = validatedFields.success
      ? {}
      : z.flattenError(validatedFields.error).fieldErrors
    if (!receipt.ok) errors.receipt = [t(refusalMessage[receipt.reason])]
    return { values, errors, message: null }
  }

  if (member.isDemo) return { values, message: await demoRefusal(lang) }

  const { category, amount, spentOn, description } = validatedFields.data
  let firstDay: string | null = null
  let key: string | null = null
  try {
    const [building] = await db
      .select({ billingStartMonth: buildings.billingStartMonth })
      .from(buildings)
      .where(eq(buildings.id, member.buildingId))
    if (!building) throw new Error(`No building ${member.buildingId}`)
    // Spending from before billing starts is part of the opening balance.
    const earliest = earliestSpentOn(building.billingStartMonth)
    if (spentOn < earliest) {
      firstDay = earliest
    } else {
      if (receipt.file) key = await put(receipt.file)
      await db.insert(expenses).values({
        buildingId: member.buildingId,
        category,
        amountAgorot: amount,
        spentOn,
        description,
        receiptKey: key,
        recordedBy: member.userId,
      })
    }
  } catch (err) {
    // Whatever stopped the row, the file it would have named goes.
    if (key) await removeOrphan(key, member.buildingId)
    unstable_rethrow(err)
    logger.error('Failed to record an expense', { area, route, buildingId: member.buildingId, err })
    return { values, message: t('saveFailed') }
  }
  if (firstDay) {
    const error = t('spentOnTooEarly', { date: formatDay(firstDay, lang) })
    return { values, errors: { spentOn: [error] }, message: null }
  }

  // The building's balance counts expenses, and it is cached under the building's tag.
  updateTag(buildingTag(member.buildingId))
  refreshExpensePages()
  return { message: null, recorded: { description, amountAgorot: amount } }
}

export type VoidExpenseState = {
  values?: { reason: string }
  errors?: { reason?: string[] }
  message?: string | null
  /** Set once the expense is voided; the confirmation closes and says what was voided. */
  voided?: { description: string; amountAgorot: number }
}

/**
 * Voids an expense (R18), with a reason: it stays listed, with its receipt, but no longer
 * comes off the fund. Expenses are never edited; a wrong one is voided and recorded anew. The
 * committee and up, for an expense of their building not voided yet; one `UPDATE … WHERE
 * voided_at IS NULL`, so two voids at once void it once. The expense is bound by its row.
 */
export async function voidExpense(
  locale: string,
  expenseId: string,
  _prevState: VoidExpenseState,
  formData: FormData,
): Promise<VoidExpenseState> {
  const lang = resolveLocale(locale)
  const values = { reason: typed(formData, 'reason') }

  const authorization = await authorizeAction('committee', lang)
  if (!authorization.ok) return { values, message: authorization.message }
  const { member } = authorization

  const t = await getTranslations({ locale: lang, namespace: 'ExpenseErrors' })
  const validatedFields = z
    .object({ reason: z.string().trim().min(3, t('reason')).max(200, t('reason')) })
    .safeParse(values)
  if (!validatedFields.success) {
    return { values, errors: z.flattenError(validatedFields.error).fieldErrors, message: null }
  }
  // A malformed id is no expense of this building.
  if (!z.uuid().safeParse(expenseId).success) return { values, message: t('notFound') }

  if (member.isDemo) return { values, message: await demoRefusal(lang) }

  const ofThisBuilding = and(eq(expenses.id, expenseId), eq(expenses.buildingId, member.buildingId))
  let voided: NonNullable<VoidExpenseState['voided']> | null
  try {
    const [row] = await db
      .update(expenses)
      .set({
        voidedAt: new Date(),
        voidedBy: member.userId,
        voidReason: validatedFields.data.reason,
      })
      .where(and(ofThisBuilding, isNull(expenses.voidedAt)))
      .returning({ description: expenses.description, amountAgorot: expenses.amountAgorot })
    if (row) {
      voided = row
    } else {
      // Nothing to void: say whether it is gone or was voided already.
      const [existing] = await db.select({ id: expenses.id }).from(expenses).where(ofThisBuilding)
      if (!existing) return { values, message: t('notFound') }
      voided = null
    }
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to void an expense', {
      area,
      route,
      buildingId: member.buildingId,
      expenseId,
      err,
    })
    return { values, message: t('voidFailed') }
  }
  if (!voided) return { values, message: t('alreadyVoided') }

  updateTag(buildingTag(member.buildingId))
  refreshExpensePages()
  return { message: null, voided }
}
