'use server'

import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { updateTag } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { demoRefusal, refreshFeePages } from '@/app/lib/actions/shared'
import { authorizeAction } from '@/app/lib/authz'
import { buildingTag } from '@/app/lib/data/cache-tags'
import { db } from '@/app/lib/db'
import type { Member } from '@/app/lib/definitions'
import { logger } from '@/app/lib/logger'
import { apartments, buildings, feeRates } from '@/app/lib/schema'
import { addMonths, currentMonthIn, formatMonth, monthPattern } from '@/app/lib/utils/dates'
import { typed, type Translate } from '@/app/lib/utils/form'
import { parseShekelsToAgorot } from '@/app/lib/utils/money'
import { pgError, pgErrorCode } from '@/app/lib/utils/pg-error'
import { resolveLocale } from '@/i18n/locale'
import type { Locale } from '@/i18n/routing'

/** How far ahead a fee may start: a typo such as 2072 would otherwise stay in the history. */
const monthsAhead = 12

type FeeField = 'apartmentId' | 'amount' | 'effectiveFrom'

function feeSchema(t: Translate<'FeeErrors'>) {
  return z.object({
    amount: z.string({ error: t('amount') }).transform((value, ctx) => {
      const agorot = parseShekelsToAgorot(value)
      // A fee of zero is no fee, and the database refuses it too.
      if (agorot === null || agorot === 0) {
        ctx.addIssue({ code: 'custom', message: t('amount') })
        return z.NEVER
      }
      return agorot
    }),
    effectiveFrom: z
      .string({ error: t('effectiveFrom') })
      .trim()
      .regex(monthPattern, t('effectiveFrom')),
  })
}

export type FeeFormState = {
  /** What the fields held, after an error. */
  values?: Partial<Record<FeeField, string>>
  errors?: Partial<Record<FeeField, string[]>>
  message?: string | null
  /** Set once the fee is saved; the dialog closes and says what was set. */
  saved?: { amountAgorot: number; effectiveFrom: string; apartmentNumber: string | null }
}

type Fee = { amountAgorot: number; effectiveFrom: string }
/** Whose fee: the building's default (no apartment), or one apartment's own. */
type Target = { apartmentId: string | null }

/**
 * The months a fee may start from, or null when the apartment is not one of the building's.
 * Never before billing starts (the apartment's own, else the building's); once the target has
 * a fee, never before the current month either, so a change cannot rewrite months that have
 * passed (spec §3), and only the current or a later month's fee can be replaced. At most a year
 * ahead.
 */
async function allowedMonths(member: Member, { apartmentId }: Target) {
  // Whether the target (the building's default, or this apartment's own) already has a rate.
  const hasRate = sql<boolean>`exists (
    SELECT 1 FROM ${feeRates}
    WHERE ${and(
      eq(feeRates.buildingId, member.buildingId),
      apartmentId ? eq(feeRates.apartmentId, apartmentId) : isNull(feeRates.apartmentId),
    )}
  )`
  const [row] = apartmentId
    ? await db
        .select({
          number: apartments.number,
          billingStartMonth: sql<string>`coalesce(${apartments.billingStartMonth}, ${buildings.billingStartMonth})`,
          hasRate,
        })
        .from(apartments)
        .innerJoin(buildings, eq(buildings.id, apartments.buildingId))
        .where(and(eq(apartments.id, apartmentId), eq(apartments.buildingId, member.buildingId)))
    : await db
        .select({
          number: sql<null>`null`,
          billingStartMonth: buildings.billingStartMonth,
          hasRate,
        })
        .from(buildings)
        .where(eq(buildings.id, member.buildingId))
  if (!row) return null
  const currentMonth = currentMonthIn(member.timeZone)
  return {
    number: row.number,
    billingStart: row.billingStartMonth,
    // Null for a first fee, which may start with billing, in the past.
    current: row.hasRate ? currentMonth : null,
    last: addMonths(currentMonth, monthsAhead),
  }
}

/**
 * Saves a fee from a month (R14), after the role, the fields and the demo refusal are checked.
 * A fee already set from that month for the same target is replaced (a correction), which
 * `allowedMonths` permits only for the current month or a later one. Earlier months keep their
 * fee, since each rate applies only from its own month.
 */
async function saveFee(
  lang: Locale,
  route: string,
  member: Member,
  target: Target,
  fee: Fee,
  values: FeeFormState['values'],
): Promise<FeeFormState> {
  const t = await getTranslations({ locale: lang, namespace: 'FeeErrors' })
  let apartmentNumber: string | null
  try {
    const months = await allowedMonths(member, target)
    if (!months) return { values, message: t('notFound') }
    if (fee.effectiveFrom < months.billingStart) {
      const month = formatMonth(months.billingStart, lang)
      return {
        values,
        errors: { effectiveFrom: [t('beforeBillingStart', { month })] },
        message: null,
      }
    }
    if (months.current && fee.effectiveFrom < months.current) {
      const month = formatMonth(months.current, lang)
      return {
        values,
        errors: { effectiveFrom: [t('beforeCurrentMonth', { month })] },
        message: null,
      }
    }
    if (fee.effectiveFrom > months.last) {
      const month = formatMonth(months.last, lang)
      return { values, errors: { effectiveFrom: [t('tooFarAhead', { month })] }, message: null }
    }
    apartmentNumber = months.number

    await db
      .insert(feeRates)
      .values({
        buildingId: member.buildingId,
        apartmentId: target.apartmentId,
        ...fee,
        createdBy: member.userId,
      })
      // The unique (building, apartment, month) treats a null apartment as a value, so the
      // building default of a month conflicts with itself too.
      .onConflictDoUpdate({
        target: [feeRates.buildingId, feeRates.apartmentId, feeRates.effectiveFrom],
        set: { amountAgorot: fee.amountAgorot, createdBy: member.userId, createdAt: sql`now()` },
      })
  } catch (err) {
    unstable_rethrow(err)
    // The apartment was removed between the check and the write.
    if (pgError(err)?.code === pgErrorCode.foreignKeyViolation) {
      return { values, message: t('notFound') }
    }
    logger.error('Failed to save a fee', {
      area: 'actions/fees',
      route,
      buildingId: member.buildingId,
      apartmentId: target.apartmentId,
      err,
    })
    return { values, message: t('saveFailed') }
  }

  // The building's billing (its fee rates) is cached under its tag.
  updateTag(buildingTag(member.buildingId))
  refreshFeePages()
  return { message: null, saved: { ...fee, apartmentNumber } }
}

/** Sets the building's default fee from a month (R14). The committee and up. */
export async function setDefault(
  locale: string,
  _prevState: FeeFormState,
  formData: FormData,
): Promise<FeeFormState> {
  const lang = resolveLocale(locale)
  const values = {
    amount: typed(formData, 'amount'),
    effectiveFrom: typed(formData, 'effectiveFrom'),
  }

  const authorization = await authorizeAction('committee', lang)
  if (!authorization.ok) return { values, message: authorization.message }
  const { member } = authorization

  const t = await getTranslations({ locale: lang, namespace: 'FeeErrors' })
  const validatedFields = feeSchema(t).safeParse(values)
  if (!validatedFields.success) {
    return { values, errors: z.flattenError(validatedFields.error).fieldErrors, message: null }
  }

  if (member.isDemo) return { values, message: await demoRefusal(lang) }

  const { amount, effectiveFrom } = validatedFields.data
  return saveFee(
    lang,
    '/admin/fees',
    member,
    { apartmentId: null },
    { amountAgorot: amount, effectiveFrom },
    values,
  )
}

/**
 * Sets one apartment's own fee from a month (R14), which it pays instead of the building's.
 * The committee and up, for an apartment of their building. `apartmentId` is bound by the
 * apartment's own page; the fees page binds null and sends the apartment the person chose.
 */
export async function setOverride(
  locale: string,
  apartmentId: string | null,
  _prevState: FeeFormState,
  formData: FormData,
): Promise<FeeFormState> {
  const lang = resolveLocale(locale)
  const values = {
    apartmentId: apartmentId ?? typed(formData, 'apartmentId'),
    amount: typed(formData, 'amount'),
    effectiveFrom: typed(formData, 'effectiveFrom'),
  }

  const authorization = await authorizeAction('committee', lang)
  if (!authorization.ok) return { values, message: authorization.message }
  const { member } = authorization

  const t = await getTranslations({ locale: lang, namespace: 'FeeErrors' })
  // A chosen apartment is a field to fix; a bound one is checked below as an id.
  const schema = feeSchema(t).extend({
    apartmentId: apartmentId === null ? z.uuid(t('apartment')) : z.string(),
  })
  const validatedFields = schema.safeParse(values)
  if (!validatedFields.success) {
    return { values, errors: z.flattenError(validatedFields.error).fieldErrors, message: null }
  }
  // A malformed id is no apartment of this building.
  if (!z.uuid().safeParse(values.apartmentId).success) return { values, message: t('notFound') }

  if (member.isDemo) return { values, message: await demoRefusal(lang) }

  const { amount, effectiveFrom } = validatedFields.data
  return saveFee(
    lang,
    // Bound on the apartment's page; chosen on the fees page.
    apartmentId === null ? '/admin/fees' : '/admin/apartments/[id]',
    member,
    { apartmentId: values.apartmentId },
    { amountAgorot: amount, effectiveFrom },
    values,
  )
}

export type FollowBuildingState = {
  message?: string | null
  /** Set once the row is saved; the confirmation closes. */
  done?: boolean
}

/**
 * Ends an apartment's own fee from a month (R14): from then it pays the building's fee again,
 * with any later change to it. Recorded as a row of its own without an amount, so the history
 * stays whole and earlier months keep the fee they had. The committee and up; only for an
 * apartment of their building whose latest own row has an amount, and for a month from the
 * current one (and not before that row starts) to a year ahead. Everything is bound by the
 * confirmation, so nothing is read from a form.
 */
export async function followBuilding(
  locale: string,
  apartmentId: string,
  month: string,
): Promise<FollowBuildingState> {
  const lang = resolveLocale(locale)

  const authorization = await authorizeAction('committee', lang)
  if (!authorization.ok) return { message: authorization.message }
  const { member } = authorization

  const t = await getTranslations({ locale: lang, namespace: 'FeeErrors' })
  // A malformed id is no apartment of this building.
  if (!z.uuid().safeParse(apartmentId).success) return { message: t('notFound') }
  if (!monthPattern.test(month)) return { message: t('effectiveFrom') }

  if (member.isDemo) return { message: await demoRefusal(lang) }

  try {
    const [months, [latestOwn]] = await Promise.all([
      allowedMonths(member, { apartmentId }),
      db
        .select({ amountAgorot: feeRates.amountAgorot, effectiveFrom: feeRates.effectiveFrom })
        .from(feeRates)
        .where(
          and(eq(feeRates.buildingId, member.buildingId), eq(feeRates.apartmentId, apartmentId)),
        )
        .orderBy(desc(feeRates.effectiveFrom))
        .limit(1),
    ])
    if (!months) return { message: t('notFound') }
    if (!latestOwn || latestOwn.amountAgorot === null) {
      return { message: t('noOwnFee', { number: months.number ?? '' }) }
    }
    // It has a fee of its own, so `current` is set: months that have passed keep theirs.
    if (months.current && month < months.current) {
      return { message: t('beforeCurrentMonth', { month: formatMonth(months.current, lang) }) }
    }
    if (month < latestOwn.effectiveFrom) {
      return { message: t('beforeOwnFee', { month: formatMonth(latestOwn.effectiveFrom, lang) }) }
    }
    if (month > months.last) {
      return { message: t('tooFarAhead', { month: formatMonth(months.last, lang) }) }
    }

    await db
      .insert(feeRates)
      .values({
        buildingId: member.buildingId,
        apartmentId,
        amountAgorot: null,
        effectiveFrom: month,
        createdBy: member.userId,
      })
      // Its own fee set from this very month, still to come, is ended before it starts.
      .onConflictDoUpdate({
        target: [feeRates.buildingId, feeRates.apartmentId, feeRates.effectiveFrom],
        set: { amountAgorot: null, createdBy: member.userId, createdAt: sql`now()` },
      })
  } catch (err) {
    unstable_rethrow(err)
    // The apartment was removed between the check and the write.
    if (pgError(err)?.code === pgErrorCode.foreignKeyViolation) return { message: t('notFound') }
    logger.error('Failed to return an apartment to the building fee', {
      area: 'actions/fees',
      // Both pages bind it alike.
      route: '/admin/fees | /admin/apartments/[id]',
      buildingId: member.buildingId,
      apartmentId,
      err,
    })
    return { message: t('saveFailed') }
  }

  // The building's billing (its fee rates) is cached under its tag.
  updateTag(buildingTag(member.buildingId))
  refreshFeePages()
  return { done: true, message: null }
}
