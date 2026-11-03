import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/app/lib/db'
import type { Member } from '@/app/lib/definitions'
import { logger } from '@/app/lib/logger'
import {
  apartmentResidents,
  apartments,
  buildingMembers,
  buildings,
  roleEnum,
} from '@/app/lib/schema'

const memberRow = z.object({
  buildingId: z.string(),
  role: z.enum(roleEnum.enumValues),
  isDemo: z.boolean(),
  timeZone: z.string(),
  buildingName: z.string(),
  apartmentIds: z.array(z.string()),
})

/**
 * The person's membership with their building and apartments, in one query, or null when
 * they belong to no building. Only apartments of that building are listed.
 */
export async function memberForUser(userId: string): Promise<Member | null> {
  try {
    const rows = await db
      .select({
        buildingId: buildingMembers.buildingId,
        role: buildingMembers.role,
        isDemo: buildings.isDemo,
        timeZone: buildings.timezone,
        buildingName: buildings.name,
        // Natural order (2 before 10): shorter numbers first, then by text.
        apartmentIds: sql`coalesce(
          array_agg(${apartments.id} order by length(${apartments.number}), ${apartments.number}) filter (where ${apartments.id} is not null),
          '{}'
        )`,
      })
      .from(buildingMembers)
      .innerJoin(buildings, eq(buildings.id, buildingMembers.buildingId))
      .leftJoin(apartmentResidents, eq(apartmentResidents.userId, buildingMembers.userId))
      .leftJoin(
        apartments,
        and(
          eq(apartments.id, apartmentResidents.apartmentId),
          eq(apartments.buildingId, buildingMembers.buildingId),
        ),
      )
      .where(eq(buildingMembers.userId, userId))
      .groupBy(buildingMembers.id, buildings.id)
    const [row] = rows
    return row ? { userId, ...memberRow.parse(row) } : null
  } catch (err) {
    logger.error('Failed to load the membership', { area: 'data/members', userId, err })
    throw new Error('Failed to load the membership')
  }
}
