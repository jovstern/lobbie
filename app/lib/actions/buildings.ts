'use server'

import { eq } from 'drizzle-orm'
import { updateTag } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { authorizeAction } from '@/app/lib/authz'
import { buildingTag } from '@/app/lib/data/cache-tags'
import { db } from '@/app/lib/db'
import { logger } from '@/app/lib/logger'
import { balanceAdjustments, buildings } from '@/app/lib/schema'
import { parseShekelsToAgorot } from '@/app/lib/utils/money'
import { resolveLocale } from '@/i18n/locale'
import type messages from '@/messages/he.json'

type Translate<Namespace extends keyof typeof messages> = (
  key: keyof (typeof messages)[Namespace],
) => string

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/

/** What a form field held when it was sent, so an error never loses the person's typing. */
function typed(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

// --- Building details ------------------------------------------------------------------

type BuildingField = 'name' | 'address' | 'quorumPercent' | 'billingStartMonth'

function buildingSchema(t: Translate<'BuildingErrors'>) {
  return z.object({
    name: z
      .string({ error: t('name') })
      .trim()
      .min(2, t('name'))
      .max(80, t('name')),
    address: z
      .string({ error: t('address') })
      .trim()
      .max(160, t('address')),
    quorumPercent: z.coerce
      .number({ error: t('quorumPercent') })
      .int(t('quorumPercent'))
      .min(1, t('quorumPercent'))
      .max(100, t('quorumPercent')),
    billingStartMonth: z
      .string({ error: t('billingStartMonth') })
      .regex(monthPattern, t('billingStartMonth')),
  })
}

export type BuildingFormState = {
  /** What the fields hold: as typed after an error, as saved after a success. */
  values?: Record<BuildingField, string>
  errors?: Partial<Record<BuildingField, string[]>>
  message?: string | null
  /** When the details were last saved, so each save is announced again. */
  savedAt?: number
  /**
   * Set instead of saving when the billing start month would change: that changes what every
   * apartment owes, past months included, so the admin confirms it first.
   */
  confirmBillingChange?: { from: string; to: string }
}

/**
 * Saves the building's details (R7). Admins only; the building is always the admin's own.
 * A new billing start month is saved only with `confirmBillingChange`, bound by the form's
 * "Save anyway" after the admin has seen what it changes.
 */
export async function update(
  locale: string,
  confirmBillingChange: boolean,
  _prevState: BuildingFormState,
  formData: FormData,
): Promise<BuildingFormState> {
  const lang = resolveLocale(locale)
  const values: Record<BuildingField, string> = {
    name: typed(formData, 'name'),
    address: typed(formData, 'address'),
    quorumPercent: typed(formData, 'quorumPercent'),
    billingStartMonth: typed(formData, 'billingStartMonth'),
  }

  const authorization = await authorizeAction('admin', lang)
  if (!authorization.ok) return { values, message: authorization.message }
  const { member } = authorization

  const t = await getTranslations({ locale: lang, namespace: 'BuildingErrors' })
  const validatedFields = buildingSchema(t).safeParse(values)
  if (!validatedFields.success) {
    return { values, errors: z.flattenError(validatedFields.error).fieldErrors, message: null }
  }

  if (member.isDemo) {
    const tDemo = await getTranslations({ locale: lang, namespace: 'Demo' })
    return { values, message: tDemo('readOnly') }
  }

  const details = validatedFields.data
  try {
    if (!confirmBillingChange) {
      const [saved] = await db
        .select({ billingStartMonth: buildings.billingStartMonth })
        .from(buildings)
        .where(eq(buildings.id, member.buildingId))
      if (saved && saved.billingStartMonth !== details.billingStartMonth) {
        return {
          values,
          message: null,
          confirmBillingChange: { from: saved.billingStartMonth, to: details.billingStartMonth },
        }
      }
    }
    await db.update(buildings).set(details).where(eq(buildings.id, member.buildingId))
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to save the building', {
      area: 'actions/buildings',
      route: '/admin/building',
      buildingId: member.buildingId,
      err,
    })
    return { values, message: t('saveFailed') }
  }

  // The building row is cached, and so is the balance, which reads its opening balance.
  updateTag(buildingTag(member.buildingId))
  return {
    values: { ...details, quorumPercent: String(details.quorumPercent) },
    message: null,
    savedAt: Date.now(),
  }
}

// --- Balance adjustments ---------------------------------------------------------------

type AdjustmentField = 'direction' | 'amount' | 'reason'

function adjustmentSchema(t: Translate<'AdjustmentErrors'>) {
  return z.object({
    direction: z.enum(['in', 'out'], { error: t('direction') }),
    amount: z.string({ error: t('amount') }).transform((value, ctx) => {
      const agorot = parseShekelsToAgorot(value)
      // A zero correction changes nothing, and the database refuses it too.
      if (agorot === null || agorot === 0) {
        ctx.addIssue({ code: 'custom', message: t('amount') })
        return z.NEVER
      }
      return agorot
    }),
    reason: z
      .string({ error: t('reason') })
      .trim()
      .min(3, t('reason'))
      .max(200, t('reason')),
  })
}

export type AdjustmentFormState = {
  values?: Record<AdjustmentField, string>
  errors?: Partial<Record<AdjustmentField, string[]>>
  message?: string | null
  /** Set once the adjustment is recorded; the dialog then closes. */
  added?: boolean
}

/**
 * Records a correction to the building fund: money in or out, with a reason (R7). The opening
 * balance itself never changes after the building is created. Admins only.
 */
export async function addAdjustment(
  locale: string,
  _prevState: AdjustmentFormState,
  formData: FormData,
): Promise<AdjustmentFormState> {
  const lang = resolveLocale(locale)
  const values: Record<AdjustmentField, string> = {
    direction: typed(formData, 'direction'),
    amount: typed(formData, 'amount'),
    reason: typed(formData, 'reason'),
  }

  const authorization = await authorizeAction('admin', lang)
  if (!authorization.ok) return { values, message: authorization.message }
  const { member } = authorization

  const t = await getTranslations({ locale: lang, namespace: 'AdjustmentErrors' })
  const validatedFields = adjustmentSchema(t).safeParse(values)
  if (!validatedFields.success) {
    return { values, errors: z.flattenError(validatedFields.error).fieldErrors, message: null }
  }

  if (member.isDemo) {
    const tDemo = await getTranslations({ locale: lang, namespace: 'Demo' })
    return { values, message: tDemo('readOnly') }
  }

  const { direction, amount, reason } = validatedFields.data
  try {
    await db.insert(balanceAdjustments).values({
      buildingId: member.buildingId,
      amountAgorot: direction === 'out' ? -amount : amount,
      reason,
      recordedBy: member.userId,
    })
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to record a balance adjustment', {
      area: 'actions/buildings',
      route: '/admin/building',
      buildingId: member.buildingId,
      err,
    })
    return { values, message: t('addFailed') }
  }

  // The building's tag, as for every write to its money: the balance is cached under it.
  updateTag(buildingTag(member.buildingId))
  return { added: true, message: null }
}
