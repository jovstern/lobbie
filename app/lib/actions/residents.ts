'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { lockMember } from '@/app/lib/admin-guard'
import { authorizeAction } from '@/app/lib/authz'
import { db } from '@/app/lib/db'
import type { Member } from '@/app/lib/definitions'
import { logger } from '@/app/lib/logger'
import { apartmentResidents, apartments, buildingMembers } from '@/app/lib/schema'
import { typed } from '@/app/lib/utils/form'
import { redirect } from '@/i18n/navigation'
import { resolveLocale } from '@/i18n/locale'
import type { Locale } from '@/i18n/routing'

// No cached read holds residents (the apartments list counts them uncached), so these actions
// update no tag; they refresh the pages that show residents and their apartments.

const route = '/admin/apartments/[id]'

async function demoRefusal(locale: Locale): Promise<string> {
  const t = await getTranslations({ locale, namespace: 'Demo' })
  return t('readOnly')
}

function refreshResidents() {
  revalidatePath('/[locale]/admin/apartments', 'page')
  revalidatePath('/[locale]/admin/apartments/[id]', 'page')
  revalidatePath('/[locale]/admin/people', 'page')
}

/** Whether both ids are well formed; a malformed one is nothing of the building. */
function validIds(...ids: string[]): boolean {
  return ids.every((id) => z.uuid().safeParse(id).success)
}

/** The building's apartments, for a filter that keeps a write inside the admin's building. */
function apartmentsOf(tx: Pick<typeof db, 'select'>, buildingId: string) {
  return tx
    .select({ id: apartments.id })
    .from(apartments)
    .where(eq(apartments.buildingId, buildingId))
}

export type OwnershipState = { message?: string | null }

const ownershipSchema = z.object({ isOwner: z.enum(['true', 'false']) })

/**
 * Marks a resident as an owner or a tenant of one apartment (R10), saved as the control
 * changes; the form sends `isOwner` as "true" or "false". Admins only, and only for an
 * apartment of their building.
 */
export async function setOwnership(
  locale: string,
  userId: string,
  apartmentId: string,
  _prevState: OwnershipState,
  formData: FormData,
): Promise<OwnershipState> {
  const lang = resolveLocale(locale)

  const authorization = await authorizeAction('admin', lang)
  if (!authorization.ok) return { message: authorization.message }
  const { member } = authorization

  const t = await getTranslations({ locale: lang, namespace: 'ResidentErrors' })
  const validatedFields = ownershipSchema.safeParse({ isOwner: typed(formData, 'isOwner') })
  if (!validatedFields.success) return { message: t('saveFailed') }
  if (!validIds(userId, apartmentId)) return { message: t('notFound') }

  if (member.isDemo) return { message: await demoRefusal(lang) }

  let updated: { userId: string }[]
  try {
    updated = await db
      .update(apartmentResidents)
      .set({ isOwner: validatedFields.data.isOwner === 'true' })
      .where(
        and(
          eq(apartmentResidents.userId, userId),
          eq(apartmentResidents.apartmentId, apartmentId),
          inArray(apartmentResidents.apartmentId, apartmentsOf(db, member.buildingId)),
        ),
      )
      .returning({ userId: apartmentResidents.userId })
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to set ownership', {
      area: 'actions/residents',
      route,
      buildingId: member.buildingId,
      apartmentId,
      userId,
      err,
    })
    return { message: t('saveFailed') }
  }
  if (updated.length === 0) return { message: t('notFound') }

  refreshResidents()
  return { message: null }
}

export type RemoveResidentState = {
  message?: string | null
  /** Set once they no longer live there; the dialog closes. */
  removed?: boolean
}

type Removal =
  { kind: 'removed'; leftBuilding: boolean } | { kind: 'missing' } | { kind: 'last-admin' }

/** Unlinks a resident from an apartment, in one transaction (see `removeFromApartment`). */
async function unlink(member: Member, userId: string, apartmentId: string): Promise<Removal> {
  return db.transaction(async (tx): Promise<Removal> => {
    const target = await lockMember(tx, member.buildingId, userId)
    if (!target) return { kind: 'missing' }

    // Their apartments of the building, locked, so two removals at once cannot both think the
    // other apartment is still there and leave a member with none.
    const homes = await tx
      .select({ apartmentId: apartmentResidents.apartmentId })
      .from(apartmentResidents)
      .where(
        and(
          eq(apartmentResidents.userId, userId),
          inArray(apartmentResidents.apartmentId, apartmentsOf(tx, member.buildingId)),
        ),
      )
      .for('update')
    if (!homes.some((home) => home.apartmentId === apartmentId)) return { kind: 'missing' }

    const leftBuilding = homes.length === 1
    // Their last apartment takes them out of the building, which the last admin may not leave.
    if (leftBuilding && target.isLastAdmin) return { kind: 'last-admin' }

    await tx
      .delete(apartmentResidents)
      .where(
        and(eq(apartmentResidents.userId, userId), eq(apartmentResidents.apartmentId, apartmentId)),
      )
    if (leftBuilding) {
      await tx
        .delete(buildingMembers)
        .where(
          and(
            eq(buildingMembers.userId, userId),
            eq(buildingMembers.buildingId, member.buildingId),
          ),
        )
    }
    return { kind: 'removed', leftBuilding }
  })
}

/**
 * Removes a resident from one apartment of the admin's building (R10). When it was their last
 * apartment, their membership goes in the same transaction: they leave the building and lose
 * access, though their account remains. Admins only; the building's last admin cannot leave
 * this way. The form sends nothing but the bound ids.
 */
export async function removeFromApartment(
  locale: string,
  userId: string,
  apartmentId: string,
): Promise<RemoveResidentState> {
  const lang = resolveLocale(locale)

  const authorization = await authorizeAction('admin', lang)
  if (!authorization.ok) return { message: authorization.message }
  const { member } = authorization

  const t = await getTranslations({ locale: lang, namespace: 'ResidentErrors' })
  if (!validIds(userId, apartmentId)) return { message: t('notFound') }

  if (member.isDemo) return { message: await demoRefusal(lang) }

  let removal: Removal
  try {
    removal = await unlink(member, userId, apartmentId)
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to remove a resident', {
      area: 'actions/residents',
      route,
      buildingId: member.buildingId,
      apartmentId,
      userId,
      err,
    })
    return { message: t('removeFailed') }
  }

  if (removal.kind === 'missing') return { message: t('notFound') }
  if (removal.kind === 'last-admin') return { message: t('lastAdmin') }

  refreshResidents()
  // An admin who took themselves out of the building has no admin pages now.
  if (removal.leftBuilding && userId === member.userId) redirect({ href: '/', locale: lang })
  return { removed: true, message: null }
}
