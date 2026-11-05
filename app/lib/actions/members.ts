'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { lockMember } from '@/app/lib/admin-guard'
import { authorizeAction } from '@/app/lib/authz'
import { db } from '@/app/lib/db'
import type { Member, Role } from '@/app/lib/definitions'
import { logger } from '@/app/lib/logger'
import { apartmentResidents, apartments, buildingMembers, roleEnum } from '@/app/lib/schema'
import { typed, type Translate } from '@/app/lib/utils/form'
import { redirect } from '@/i18n/navigation'
import { resolveLocale } from '@/i18n/locale'
import type { Locale } from '@/i18n/routing'

// No cached read holds roles or memberships (requireMember reads them on every request), so
// these actions update no tag; they refresh the admin pages that list people.

const route = '/admin/people'

type RoleField = 'role' | 'committeeTitle'

function roleSchema(t: Translate<'MemberErrors'>) {
  return z
    .object({
      role: z.enum(roleEnum.enumValues, { error: t('role') }),
      committeeTitle: z
        .string()
        .trim()
        .max(40, t('committeeTitle'))
        .transform((value) => value || null),
    })
    .transform(({ role, committeeTitle }) => ({
      role,
      // A title belongs to the committee (admins included); a resident never keeps one.
      committeeTitle: role === 'resident' ? null : committeeTitle,
    }))
}

export type RoleFormState = {
  /** What the fields hold after an error: as sent. */
  values?: Record<RoleField, string>
  errors?: Partial<Record<RoleField, string[]>>
  message?: string | null
  /** Set once saved, with the role saved; the dialog closes. */
  saved?: { role: Role }
}

async function demoRefusal(locale: Locale): Promise<string> {
  const t = await getTranslations({ locale, namespace: 'Demo' })
  return t('readOnly')
}

/** The admin pages that list people or residents, refreshed after a write. */
function refreshPeople() {
  revalidatePath('/[locale]/admin/people', 'page')
  revalidatePath('/[locale]/admin/apartments', 'page')
  revalidatePath('/[locale]/admin/apartments/[id]', 'page')
}

type RoleChange = { kind: 'saved' } | { kind: 'missing' } | { kind: 'last-admin' }

/**
 * Sets a member's role and committee title (R10). Admins only, and only for a member of their
 * building. The building's last admin cannot be demoted. An admin may demote themselves while
 * another admin remains; they then lose the admin pages, so they go home.
 */
export async function setRole(
  locale: string,
  userId: string,
  _prevState: RoleFormState,
  formData: FormData,
): Promise<RoleFormState> {
  const lang = resolveLocale(locale)
  const values = {
    role: typed(formData, 'role'),
    committeeTitle: typed(formData, 'committeeTitle'),
  }

  const authorization = await authorizeAction('admin', lang)
  if (!authorization.ok) return { values, message: authorization.message }
  const { member } = authorization

  const t = await getTranslations({ locale: lang, namespace: 'MemberErrors' })
  const validatedFields = roleSchema(t).safeParse(values)
  if (!validatedFields.success) {
    return { values, errors: z.flattenError(validatedFields.error).fieldErrors, message: null }
  }
  // A malformed id is no member of this building.
  if (!z.uuid().safeParse(userId).success) return { values, message: t('notFound') }

  if (member.isDemo) return { values, message: await demoRefusal(lang) }

  const { role, committeeTitle } = validatedFields.data
  let change: RoleChange
  try {
    change = await db.transaction(async (tx): Promise<RoleChange> => {
      const target = await lockMember(tx, member.buildingId, userId)
      if (!target) return { kind: 'missing' }
      if (target.isLastAdmin && role !== 'admin') return { kind: 'last-admin' }

      await tx
        .update(buildingMembers)
        .set({ role, committeeTitle })
        .where(
          and(
            eq(buildingMembers.userId, userId),
            eq(buildingMembers.buildingId, member.buildingId),
          ),
        )
      return { kind: 'saved' }
    })
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to set a role', {
      area: 'actions/members',
      route,
      buildingId: member.buildingId,
      userId,
      err,
    })
    return { values, message: t('saveFailed') }
  }

  if (change.kind === 'missing') return { values, message: t('notFound') }
  if (change.kind === 'last-admin') return { values, message: t('lastAdminDemote') }

  refreshPeople()
  // Their own admin pages are gone with the role: the next request sees it (requireMember reads
  // the role from the database each time).
  if (userId === member.userId && role !== 'admin') redirect({ href: '/', locale: lang })
  return { saved: { role }, message: null }
}

export type RemoveMemberState = {
  message?: string | null
  /** Set once they are out of the building; the dialog closes. */
  removed?: boolean
}

type Removal = { kind: 'removed' } | { kind: 'missing' } | { kind: 'last-admin' }

/** Takes a member out of the building, in one transaction (see `removeFromBuilding`). */
async function removeMember(member: Member, userId: string): Promise<Removal> {
  return db.transaction(async (tx): Promise<Removal> => {
    const target = await lockMember(tx, member.buildingId, userId)
    if (!target) return { kind: 'missing' }
    if (target.isLastAdmin) return { kind: 'last-admin' }

    const buildingApartments = tx
      .select({ id: apartments.id })
      .from(apartments)
      .where(eq(apartments.buildingId, member.buildingId))
    await tx
      .delete(apartmentResidents)
      .where(
        and(
          eq(apartmentResidents.userId, userId),
          inArray(apartmentResidents.apartmentId, buildingApartments),
        ),
      )
    await tx
      .delete(buildingMembers)
      .where(
        and(eq(buildingMembers.userId, userId), eq(buildingMembers.buildingId, member.buildingId)),
      )
    return { kind: 'removed' }
  })
}

/**
 * Removes someone from the building (R10): every apartment link of theirs and their membership,
 * in one transaction. Their account remains, and a new invite brings them back. Admins only,
 * and never the building's last admin. The form sends nothing but the bound id.
 */
export async function removeFromBuilding(
  locale: string,
  userId: string,
): Promise<RemoveMemberState> {
  const lang = resolveLocale(locale)

  const authorization = await authorizeAction('admin', lang)
  if (!authorization.ok) return { message: authorization.message }
  const { member } = authorization

  const t = await getTranslations({ locale: lang, namespace: 'MemberErrors' })
  if (!z.uuid().safeParse(userId).success) return { message: t('notFound') }

  if (member.isDemo) return { message: await demoRefusal(lang) }

  let removal: Removal
  try {
    removal = await removeMember(member, userId)
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to remove a member', {
      area: 'actions/members',
      route,
      buildingId: member.buildingId,
      userId,
      err,
    })
    return { message: t('removeFailed') }
  }

  if (removal.kind === 'missing') return { message: t('notFound') }
  if (removal.kind === 'last-admin') return { message: t('lastAdminRemove') }

  refreshPeople()
  // An admin who removed themselves has no building now: home sends them to /join.
  if (userId === member.userId) redirect({ href: '/', locale: lang })
  return { removed: true, message: null }
}
