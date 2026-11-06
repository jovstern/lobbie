'use server'

import { and, eq } from 'drizzle-orm'
import { unstable_rethrow } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { demoRefusal, refreshApartmentPages } from '@/app/lib/actions/shared'
import { authorizeAction } from '@/app/lib/authz'
import { blockerCounts } from '@/app/lib/data/apartments'
import { db } from '@/app/lib/db'
import type { Member } from '@/app/lib/definitions'
import { logger } from '@/app/lib/logger'
import { apartments, invites } from '@/app/lib/schema'
import { blockersOf, describeBlockers } from '@/app/lib/utils/apartment-blockers'
import { monthPattern } from '@/app/lib/utils/dates'
import { typed, type Translate } from '@/app/lib/utils/form'
import { pgError, pgErrorCode } from '@/app/lib/utils/pg-error'
import { resolveLocale } from '@/i18n/locale'

// No cached read holds apartments: the building's cached billing has only its own start month
// and fee rates, and each apartment's start month is read with the person's apartments,
// uncached. So these actions update no tag; they refresh the admin's apartment pages.

const numberUnique = 'apartments_building_id_number_unique'
const route = '/admin/apartments'

type ApartmentField = 'number' | 'floor' | 'billingStartMonth'

function apartmentSchema(t: Translate<'ApartmentErrors'>) {
  return z.object({
    number: z
      .string({ error: t('number') })
      .trim()
      .min(1, t('number'))
      .max(10, t('number')),
    // Digits only, so an empty field or "1e2" is not read as a number.
    floor: z
      .string({ error: t('floor') })
      .trim()
      .regex(/^-?\d{1,3}$/, t('floor'))
      .transform(Number)
      .pipe(z.number().int().min(-5, t('floor')).max(200, t('floor'))),
    // Empty is the building's month.
    billingStartMonth: z
      .string({ error: t('billingStartMonth') })
      .trim()
      .transform((value) => value || null)
      .pipe(z.string().regex(monthPattern, t('billingStartMonth')).nullable()),
  })
}

export type ApartmentFormState = {
  /** What the fields hold: as typed after an error or a question. */
  values?: Record<ApartmentField, string>
  errors?: Partial<Record<ApartmentField, string[]>>
  message?: string | null
  /** Set once the apartment is saved, with the number it was saved under; the dialog closes. */
  saved?: { number: string }
  /**
   * Set instead of saving when the apartment's billing start would change: that changes what
   * it owes, past months included, so the admin confirms it first. Null is the building's month.
   */
  confirmBillingChange?: { from: string | null; to: string | null }
}

function valuesOf(formData: FormData): Record<ApartmentField, string> {
  return {
    number: typed(formData, 'number'),
    floor: typed(formData, 'floor'),
    billingStartMonth: typed(formData, 'billingStartMonth'),
  }
}

/**
 * A failed insert or update: the number taken by another apartment of the building is a field
 * error; anything else is logged and reported as a failed save.
 */
function saveFailure(
  err: unknown,
  t: Awaited<ReturnType<typeof getTranslations>>,
  values: Record<ApartmentField, string>,
  number: string,
  member: Member,
): ApartmentFormState {
  const cause = pgError(err)
  if (cause?.code === pgErrorCode.uniqueViolation && cause.constraint === numberUnique) {
    return { values, errors: { number: [t('duplicate', { number })] }, message: null }
  }
  logger.error('Failed to save an apartment', {
    area: 'actions/apartments',
    route,
    buildingId: member.buildingId,
    err,
  })
  return { values, message: t('saveFailed') }
}

/** Adds an apartment to the admin's building (R8). Admins only. */
export async function create(
  locale: string,
  _prevState: ApartmentFormState,
  formData: FormData,
): Promise<ApartmentFormState> {
  const lang = resolveLocale(locale)
  const values = valuesOf(formData)

  const authorization = await authorizeAction('admin', lang)
  if (!authorization.ok) return { values, message: authorization.message }
  const { member } = authorization

  const t = await getTranslations({ locale: lang, namespace: 'ApartmentErrors' })
  const validatedFields = apartmentSchema(t).safeParse(values)
  if (!validatedFields.success) {
    return { values, errors: z.flattenError(validatedFields.error).fieldErrors, message: null }
  }

  if (member.isDemo) return { values, message: await demoRefusal(lang) }

  const apartment = validatedFields.data
  try {
    // The building's unique number is the database's to enforce: a check first would race.
    await db.insert(apartments).values({ ...apartment, buildingId: member.buildingId })
  } catch (err) {
    unstable_rethrow(err)
    return saveFailure(err, t, values, apartment.number, member)
  }

  refreshApartmentPages()
  return { saved: { number: apartment.number }, message: null }
}

/**
 * Saves an apartment's number, floor and billing start (R8). Admins only, and only an
 * apartment of their building. A new billing start is saved only with `confirmBillingChange`,
 * bound by the form's "Save anyway" after the admin has seen what it changes.
 */
export async function update(
  locale: string,
  id: string,
  confirmBillingChange: boolean,
  _prevState: ApartmentFormState,
  formData: FormData,
): Promise<ApartmentFormState> {
  const lang = resolveLocale(locale)
  const values = valuesOf(formData)

  const authorization = await authorizeAction('admin', lang)
  if (!authorization.ok) return { values, message: authorization.message }
  const { member } = authorization

  const t = await getTranslations({ locale: lang, namespace: 'ApartmentErrors' })
  const validatedFields = apartmentSchema(t).safeParse(values)
  if (!validatedFields.success) {
    return { values, errors: z.flattenError(validatedFields.error).fieldErrors, message: null }
  }
  // A malformed id is no apartment of this building.
  if (!z.uuid().safeParse(id).success) return { values, message: t('notFound') }

  if (member.isDemo) return { values, message: await demoRefusal(lang) }

  const apartment = validatedFields.data
  const ofThisBuilding = and(eq(apartments.id, id), eq(apartments.buildingId, member.buildingId))
  try {
    const [saved] = await db
      .select({ billingStartMonth: apartments.billingStartMonth })
      .from(apartments)
      .where(ofThisBuilding)
    if (!saved) return { values, message: t('notFound') }

    if (!confirmBillingChange && saved.billingStartMonth !== apartment.billingStartMonth) {
      return {
        values,
        message: null,
        confirmBillingChange: { from: saved.billingStartMonth, to: apartment.billingStartMonth },
      }
    }

    const updated = await db
      .update(apartments)
      .set(apartment)
      .where(ofThisBuilding)
      .returning({ id: apartments.id })
    // Removed between the read and the write.
    if (updated.length === 0) return { values, message: t('notFound') }
  } catch (err) {
    unstable_rethrow(err)
    return saveFailure(err, t, values, apartment.number, member)
  }

  refreshApartmentPages()
  return { saved: { number: apartment.number }, message: null }
}

export type RemoveApartmentState = {
  message?: string | null
  /** Set once the apartment is gone; the dialog closes. */
  removed?: boolean
}

type Removal = { kind: 'removed' } | { kind: 'missing' } | { kind: 'blocked'; reason: string }

/**
 * Removes an apartment nothing points at (R8). Admins only. Residents, an active invite,
 * payments and fee overrides block it, with the reason; the list says so first, and this
 * checks again. The form sends nothing but the bound id, so the form's state and data are not
 * read.
 */
export async function remove(locale: string, id: string): Promise<RemoveApartmentState> {
  const lang = resolveLocale(locale)

  const authorization = await authorizeAction('admin', lang)
  if (!authorization.ok) return { message: authorization.message }
  const { member } = authorization

  const t = await getTranslations({ locale: lang, namespace: 'ApartmentErrors' })
  if (!z.uuid().safeParse(id).success) return { message: t('notFound') }

  if (member.isDemo) return { message: await demoRefusal(lang) }

  const ofThisBuilding = and(eq(apartments.id, id), eq(apartments.buildingId, member.buildingId))
  let removal: Removal
  try {
    removal = await db.transaction(async (tx): Promise<Removal> => {
      // The lock first, in its own statement: a resident or payment being added holds a key
      // lock on the apartment, so this waits for it, and the counts below (a new snapshot)
      // then see it. Anything added later waits for this transaction and finds no apartment.
      const [locked] = await tx
        .select({ id: apartments.id })
        .from(apartments)
        .where(ofThisBuilding)
        .for('update')
      if (!locked) return { kind: 'missing' }

      const [counts] = await tx.select(blockerCounts).from(apartments).where(ofThisBuilding)
      const blockers = blockersOf(counts)
      if (blockers.length > 0) {
        const tBlockers = await getTranslations({ locale: lang, namespace: 'ApartmentBlockers' })
        return {
          kind: 'blocked',
          reason: `${t('blocked')} ${describeBlockers(tBlockers, blockers)}`,
        }
      }

      // Only dead invites are left (an active one blocks above); no one can use them, and
      // their foreign key would otherwise keep the apartment forever.
      await tx
        .delete(invites)
        .where(and(eq(invites.apartmentId, id), eq(invites.buildingId, member.buildingId)))
      await tx.delete(apartments).where(ofThisBuilding)
      return { kind: 'removed' }
    })
  } catch (err) {
    unstable_rethrow(err)
    // The foreign keys are the last word: a row that points here and that the counts do not
    // know of (a table added later) still stops the removal.
    if (pgError(err)?.code === pgErrorCode.foreignKeyViolation) {
      return { message: t('hasHistory') }
    }
    logger.error('Failed to remove an apartment', {
      area: 'actions/apartments',
      route,
      buildingId: member.buildingId,
      apartmentId: id,
      err,
    })
    return { message: t('removeFailed') }
  }

  if (removal.kind === 'missing') return { message: t('notFound') }
  if (removal.kind === 'blocked') return { message: removal.reason }

  refreshApartmentPages()
  return { removed: true, message: null }
}
