import 'server-only'
import { and, eq } from 'drizzle-orm'
import { unstable_rethrow } from 'next/navigation'
import { z } from 'zod'
import { requireMember } from '@/app/lib/authz'
import { db } from '@/app/lib/db'
import type { Profile } from '@/app/lib/definitions'
import { logger } from '@/app/lib/logger'
import { buildingMembers, roleEnum, user } from '@/app/lib/schema'
import { routing } from '@/i18n/routing'

const profileRow = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  // A value the app no longer knows reads as the default language.
  locale: z.enum(routing.locales).catch(routing.defaultLocale),
  role: z.enum(roleEnum.enumValues),
  showContact: z.boolean(),
  committeeTitle: z.string().nullable(),
  committeePhone: z.string().nullable(),
  committeeEmail: z.string().nullable(),
})

/**
 * The signed-in member's profile and settings in their building (R13), in one query. Read
 * from the database, not the session: Better Auth's cookie cache would show the name as it was
 * before an edit for up to five minutes. Not cached, as nothing per user is.
 */
export async function me(): Promise<Profile> {
  const { userId, buildingId } = await requireMember()
  try {
    const [row] = await db
      .select({
        name: user.name,
        email: user.email,
        phone: user.phone,
        locale: user.locale,
        role: buildingMembers.role,
        showContact: buildingMembers.showContact,
        committeeTitle: buildingMembers.committeeTitle,
        committeePhone: buildingMembers.committeePhone,
        committeeEmail: buildingMembers.committeeEmail,
      })
      .from(user)
      .innerJoin(
        buildingMembers,
        and(eq(buildingMembers.userId, user.id), eq(buildingMembers.buildingId, buildingId)),
      )
      .where(eq(user.id, userId))
    if (!row) throw new Error(`No profile for ${userId} in ${buildingId}`)
    return profileRow.parse(row)
  } catch (err) {
    // Next's own signals (such as a prerender that ended) are not failures.
    unstable_rethrow(err)
    logger.error('Failed to load the profile', { area: 'data/users', userId, buildingId, err })
    throw new Error('Failed to load the profile')
  }
}
