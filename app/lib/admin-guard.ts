import 'server-only'
import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '@/app/lib/db'
import type { Role } from '@/app/lib/definitions'
import { buildingMembers } from '@/app/lib/schema'

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

export type LockedMember = {
  role: Role
  /** Whether they are the building's only admin: they may be neither demoted nor removed. */
  isLastAdmin: boolean
}

/**
 * Locks a member of the building for a change of role or a removal, with what the last-admin
 * guard needs, or null when they are no member of that building. Call it first in the
 * transaction.
 *
 * The building's admin memberships are locked `FOR UPDATE` before the person's own, always in
 * the same order, so two changes at once cannot deadlock and cannot both count an admin the
 * other is demoting: the second waits, and Postgres then re-reads each locked row, leaving out
 * one that is no longer an admin. An admin promoted meanwhile is not counted, which can only
 * refuse a change, never allow one wrongly.
 */
export async function lockMember(
  tx: Tx,
  buildingId: string,
  userId: string,
): Promise<LockedMember | null> {
  const admins = await tx
    .select({ userId: buildingMembers.userId })
    .from(buildingMembers)
    .where(and(eq(buildingMembers.buildingId, buildingId), eq(buildingMembers.role, 'admin')))
    .orderBy(asc(buildingMembers.id))
    .for('update')
  const [target] = await tx
    .select({ role: buildingMembers.role })
    .from(buildingMembers)
    .where(and(eq(buildingMembers.userId, userId), eq(buildingMembers.buildingId, buildingId)))
    .for('update')
  if (!target) return null
  return { role: target.role, isLastAdmin: target.role === 'admin' && admins.length <= 1 }
}
