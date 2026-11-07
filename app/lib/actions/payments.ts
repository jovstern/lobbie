'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { updateTag } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { demoRefusal, refreshPaymentPages } from '@/app/lib/actions/shared'
import { authorizeAction } from '@/app/lib/authz'
import { readBilling } from '@/app/lib/billing'
import { buildingTag } from '@/app/lib/data/cache-tags'
import { db } from '@/app/lib/db'
import type { MonthStatus } from '@/app/lib/definitions'
import { logger } from '@/app/lib/logger'
import { apartments, paymentMethodEnum, payments } from '@/app/lib/schema'
import {
  addMonths,
  currentMonthIn,
  formatMonth,
  isCalendarDate,
  monthPattern,
  todayIn,
} from '@/app/lib/utils/dates'
import { typed, type Translate } from '@/app/lib/utils/form'
import { formatAgorot, parseShekelsToAgorot } from '@/app/lib/utils/money'
import { earliestPaidOn, paymentMonthsAhead, splitPayment } from '@/app/lib/utils/payments'
import { monthStatus, type ApartmentBilling } from '@/app/lib/utils/status'
import { resolveLocale } from '@/i18n/locale'
import type { Locale } from '@/i18n/routing'

type PaymentField = 'months' | 'amount' | 'paidOn' | 'method' | 'note'

function paymentSchema(t: Translate<'PaymentErrors'>, today: string) {
  return z.object({
    // Each month once, however often the form sent it.
    months: z
      .array(z.string().regex(monthPattern, t('months')), { error: t('months') })
      .min(1, t('months'))
      .transform((months) => [...new Set(months)]),
    amount: z.string({ error: t('amount') }).transform((value, ctx) => {
      const agorot = parseShekelsToAgorot(value)
      // A payment of zero is no payment, and the database refuses it too.
      if (agorot === null || agorot === 0) {
        ctx.addIssue({ code: 'custom', message: t('amount') })
        return z.NEVER
      }
      return agorot
    }),
    paidOn: z
      .string({ error: t('paidOn') })
      .refine(isCalendarDate, t('paidOn'))
      // Dates as `YYYY-MM-DD` compare as strings.
      .refine((date) => date <= today, t('paidOnFuture')),
    method: z.enum(paymentMethodEnum.enumValues, { error: t('method') }),
    note: z
      .string()
      .trim()
      .max(200, t('note'))
      .transform((note) => note || null),
  })
}

export type PaymentFormState = {
  /** What the fields held, after an error. */
  values?: { months: string[]; amount: string; paidOn: string; method: string; note: string }
  errors?: Partial<Record<PaymentField, string[]>>
  message?: string | null
  /** Set once the payment is recorded; the dialog closes and says what was recorded. */
  recorded?: { apartmentNumber: string; amountAgorot: number; months: string[] }
}

/**
 * Why a payment cannot go to a month, or null when it can: more than a year ahead, before
 * billing starts, without a fee, or already paid in full.
 */
function monthRefusal(
  t: Awaited<ReturnType<typeof getTranslations<'PaymentErrors'>>>,
  lang: Locale,
  billing: ApartmentBilling,
  month: string,
  kind: MonthStatus['kind'],
  lastMonth: string,
): string | null {
  if (month > lastMonth) return t('tooFarAhead', { month: formatMonth(lastMonth, lang) })
  switch (kind) {
    case 'not-billed': {
      const start = billing.apartment.billingStartMonth ?? billing.buildingBillingStartMonth
      return t('notBilled', { month: formatMonth(start, lang) })
    }
    case 'no-fee':
      return t('noFee', { month: formatMonth(month, lang) })
    case 'paid':
      return t('paid', { month: formatMonth(month, lang) })
    default:
      return null
  }
}

type Recording =
  | { kind: 'missing' }
  | {
      kind: 'refused'
      field: 'months' | 'amount' | 'paidOn'
      error: string
      /** Another recording changed what is owed since the form opened: its pages are stale. */
      stale: boolean
    }
  | { kind: 'recorded'; apartmentNumber: string }

/**
 * Records a payment for one or several months (R15), split into one row per month in one
 * transaction, oldest month first, and never more than each month still owes. The committee
 * and up, for an apartment of their building, bound by the page it is recorded from.
 *
 * The apartment is locked first (NO KEY UPDATE), so two recordings for it run one after the
 * other: the second reads the payments again once the first has committed, and cannot pay a
 * month twice. NO KEY UPDATE, not UPDATE: inserting a resident or an invite of the apartment
 * takes KEY SHARE on it through their foreign keys, which this leaves free; removing the
 * apartment (FOR UPDATE) and editing it wait for this.
 */
export async function record(
  locale: string,
  apartmentId: string,
  _prevState: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const lang = resolveLocale(locale)
  const values = {
    months: formData.getAll('months').filter((month) => typeof month === 'string'),
    amount: typed(formData, 'amount'),
    paidOn: typed(formData, 'paidOn'),
    method: typed(formData, 'method'),
    note: typed(formData, 'note'),
  }

  const authorization = await authorizeAction('committee', lang)
  if (!authorization.ok) return { values, message: authorization.message }
  const { member } = authorization

  const t = await getTranslations({ locale: lang, namespace: 'PaymentErrors' })
  const validatedFields = paymentSchema(t, todayIn(member.timeZone)).safeParse(values)
  if (!validatedFields.success) {
    return { values, errors: z.flattenError(validatedFields.error).fieldErrors, message: null }
  }
  // A malformed id is no apartment of this building.
  if (!z.uuid().safeParse(apartmentId).success) return { values, message: t('notFound') }

  if (member.isDemo) return { values, message: await demoRefusal(lang) }

  const { months, amount, paidOn, method, note } = validatedFields.data
  let recording: Recording
  try {
    recording = await db.transaction(async (tx): Promise<Recording> => {
      const [locked] = await tx
        .select({ id: apartments.id })
        .from(apartments)
        .where(and(eq(apartments.id, apartmentId), eq(apartments.buildingId, member.buildingId)))
        .for('no key update')
      if (!locked) return { kind: 'missing' }

      // Read after the lock, so a payment another recording just committed is counted.
      const currentMonth = currentMonthIn(member.timeZone)
      const billing = await readBilling(tx, member.buildingId, apartmentId, currentMonth)
      if (!billing) return { kind: 'missing' }
      const lastMonth = addMonths(currentMonth, paymentMonthsAhead)

      // Paid in advance at most a year before billing starts; an earlier date is a typo (2002
      // for 2026).
      const firstDay = earliestPaidOn(
        billing.apartment.billingStartMonth ?? billing.buildingBillingStartMonth,
      )
      if (paidOn < firstDay) {
        const error = t('paidOnTooEarly', { month: formatMonth(firstDay.slice(0, 7), lang) })
        return { kind: 'refused', field: 'paidOn', error, stale: false }
      }

      const owed: { month: string; remainingAgorot: number }[] = []
      for (const month of months.toSorted()) {
        const status = monthStatus(billing, month)
        const refusal = monthRefusal(t, lang, billing, month, status.kind, lastMonth)
        // A month paid since the form opened: another recording got there first.
        if (refusal) {
          return { kind: 'refused', field: 'months', error: refusal, stale: status.kind === 'paid' }
        }
        if ('remainingAgorot' in status)
          owed.push({ month, remainingAgorot: status.remainingAgorot })
      }

      const split = splitPayment(amount, owed)
      if (!split.ok) {
        const error =
          split.reason === 'tooMuch'
            ? t('tooMuch', { amount: formatAgorot(split.owedAgorot, lang) })
            : t('tooLittle', { month: formatMonth(split.month, lang) })
        // More than is left can only mean the form's amounts are out of date.
        return { kind: 'refused', field: 'amount', error, stale: split.reason === 'tooMuch' }
      }

      await tx.insert(payments).values(
        split.parts.map((part) => ({
          buildingId: member.buildingId,
          apartmentId,
          month: part.month,
          amountAgorot: part.amountAgorot,
          paidOn,
          method,
          note,
          recordedBy: member.userId,
        })),
      )
      return { kind: 'recorded', apartmentNumber: billing.number }
    })
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to record a payment', {
      area: 'actions/payments',
      route: '/admin/payments | /admin/apartments/[id]',
      buildingId: member.buildingId,
      apartmentId,
      err,
    })
    return { values, message: t('saveFailed') }
  }

  if (recording.kind === 'missing') return { values, message: t('notFound') }
  if (recording.kind === 'refused') {
    // The dialog's months and amounts update from the refreshed page; the error stays shown.
    if (recording.stale) refreshPaymentPages()
    return { values, errors: { [recording.field]: [recording.error] }, message: null }
  }

  // The building's balance counts payments, and it is cached under the building's tag.
  updateTag(buildingTag(member.buildingId))
  refreshPaymentPages()
  return {
    message: null,
    recorded: { apartmentNumber: recording.apartmentNumber, amountAgorot: amount, months },
  }
}

export type VoidPaymentState = {
  values?: { reason: string }
  errors?: { reason?: string[] }
  message?: string | null
  /** Set once the payment is voided; the confirmation closes and says what was voided. */
  voided?: { apartmentNumber: string; month: string; amountAgorot: number }
}

/**
 * Voids a payment (R15), with a reason: it stays listed but no longer counts, so its month owes
 * again. Payments are never edited; a wrong one is voided and recorded anew. The committee and
 * up, for a payment of their building that is not voided yet; one `UPDATE … WHERE voided_at IS
 * NULL`, so two voids at once void it once. The payment is bound by its row.
 */
export async function voidPayment(
  locale: string,
  paymentId: string,
  _prevState: VoidPaymentState,
  formData: FormData,
): Promise<VoidPaymentState> {
  const lang = resolveLocale(locale)
  const values = { reason: typed(formData, 'reason') }

  const authorization = await authorizeAction('committee', lang)
  if (!authorization.ok) return { values, message: authorization.message }
  const { member } = authorization

  const t = await getTranslations({ locale: lang, namespace: 'PaymentErrors' })
  const validatedFields = z
    .object({ reason: z.string().trim().min(3, t('reason')).max(200, t('reason')) })
    .safeParse(values)
  if (!validatedFields.success) {
    return { values, errors: z.flattenError(validatedFields.error).fieldErrors, message: null }
  }
  // A malformed id is no payment of this building.
  if (!z.uuid().safeParse(paymentId).success) return { values, message: t('paymentNotFound') }

  if (member.isDemo) return { values, message: await demoRefusal(lang) }

  const ofThisBuilding = and(eq(payments.id, paymentId), eq(payments.buildingId, member.buildingId))
  let voided: NonNullable<VoidPaymentState['voided']> | null
  try {
    const [row] = await db
      .update(payments)
      .set({
        voidedAt: new Date(),
        voidedBy: member.userId,
        voidReason: validatedFields.data.reason,
      })
      .from(apartments)
      .where(
        and(ofThisBuilding, isNull(payments.voidedAt), eq(apartments.id, payments.apartmentId)),
      )
      .returning({
        apartmentNumber: apartments.number,
        month: payments.month,
        amountAgorot: payments.amountAgorot,
      })
    if (row) {
      voided = row
    } else {
      // Nothing to void: say whether it is gone or was voided already.
      const [existing] = await db.select({ id: payments.id }).from(payments).where(ofThisBuilding)
      if (!existing) return { values, message: t('paymentNotFound') }
      voided = null
    }
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to void a payment', {
      area: 'actions/payments',
      route: '/admin/payments | /admin/apartments/[id]',
      buildingId: member.buildingId,
      paymentId,
      err,
    })
    return { values, message: t('voidFailed') }
  }
  if (!voided) return { values, message: t('alreadyVoided') }

  updateTag(buildingTag(member.buildingId))
  refreshPaymentPages()
  return { message: null, voided }
}
