import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { cacheLife, cacheTag } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { requireRole } from '@/app/lib/authz'
import { buildingTag } from '@/app/lib/data/cache-tags'
import { db } from '@/app/lib/db'
import type { BalanceAdjustment, BuildingDetails } from '@/app/lib/definitions'
import { logger } from '@/app/lib/logger'
import { balanceAdjustments, buildings, user } from '@/app/lib/schema'

/** The building row, the same for everyone, cached until a write to it updates the tag. */
async function buildingDetails(buildingId: string): Promise<BuildingDetails | undefined> {
  'use cache'
  cacheTag(buildingTag(buildingId))
  cacheLife('hours')
  const [row] = await db
    .select({
      name: buildings.name,
      address: buildings.address,
      quorumPercent: buildings.quorumPercent,
      billingStartMonth: buildings.billingStartMonth,
      openingBalanceAgorot: buildings.openingBalanceAgorot,
    })
    .from(buildings)
    .where(eq(buildings.id, buildingId))
  return row
}

/** The admin's own building's details. Admins only: anyone else gets a 404. */
export async function get(): Promise<BuildingDetails> {
  const { buildingId } = await requireRole('admin')
  try {
    const details = await buildingDetails(buildingId)
    if (!details) throw new Error(`No building ${buildingId}`)
    return details
  } catch (err) {
    // Next's own signals (such as a prerender that ended) are not failures.
    unstable_rethrow(err)
    logger.error('Failed to load the building', { area: 'data/buildings', buildingId, err })
    throw new Error('Failed to load the building')
  }
}

/**
 * The balance adjustments of the admin's own building, newest first, with who recorded each.
 * Admins only. Not paginated: corrections are rare, a handful a year.
 */
export async function adjustments(): Promise<BalanceAdjustment[]> {
  const { buildingId } = await requireRole('admin')
  try {
    return await db
      .select({
        id: balanceAdjustments.id,
        amountAgorot: balanceAdjustments.amountAgorot,
        reason: balanceAdjustments.reason,
        recordedByName: user.name,
        createdAt: balanceAdjustments.createdAt,
      })
      .from(balanceAdjustments)
      .innerJoin(user, eq(user.id, balanceAdjustments.recordedBy))
      .where(eq(balanceAdjustments.buildingId, buildingId))
      .orderBy(desc(balanceAdjustments.createdAt), desc(balanceAdjustments.id))
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to load balance adjustments', {
      area: 'data/buildings',
      buildingId,
      err,
    })
    throw new Error('Failed to load balance adjustments')
  }
}
