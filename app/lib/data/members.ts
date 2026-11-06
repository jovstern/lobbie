import 'server-only'
import { and, eq, ilike, or, sql } from 'drizzle-orm'
import { unstable_rethrow } from 'next/navigation'
import { z } from 'zod'
// authz reads memberForUser from here; this module needs requireRole only when a list is
// asked for, long after both modules have loaded.
import { requireRole } from '@/app/lib/authz'
import { byNumber } from '@/app/lib/data/apartments'
import { db } from '@/app/lib/db'
import type { Member, Person } from '@/app/lib/definitions'
import { logger } from '@/app/lib/logger'
import {
  apartmentResidents,
  apartments,
  buildingMembers,
  buildings,
  roleEnum,
  user,
} from '@/app/lib/schema'
import { searchTerm } from '@/app/lib/utils/search'

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
    // Next's own signals (such as a prerender that ended) are not failures.
    unstable_rethrow(err)
    logger.error('Failed to load the membership', { area: 'data/members', userId, err })
    throw new Error('Failed to load the membership')
  }
}

const personRow = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(roleEnum.enumValues),
  committeeTitle: z.string().nullable(),
  apartments: z.array(z.object({ id: z.string(), number: z.string() })),
})

/**
 * Everyone in the admin's building (R10), by name, each with their apartments in natural order,
 * in one query. `q` narrows it to names or emails containing it (someone who joined without
 * a name is known by their email) or to the people of the apartment it names. Name and email only: no contact settings. Admins only; anyone else gets a 404.
 */
export async function list(q: string): Promise<Person[]> {
  const { buildingId } = await requireRole('admin')
  const term = searchTerm(q)
  try {
    const rows = await db
      .select({
        userId: user.id,
        name: user.name,
        email: user.email,
        role: buildingMembers.role,
        committeeTitle: buildingMembers.committeeTitle,
        apartments: sql`coalesce(
          json_agg(
            json_build_object('id', ${apartments.id}, 'number', ${apartments.number})
            order by ${sql.join(byNumber, sql`, `)}
          ) filter (where ${apartments.id} is not null),
          '[]'
        )`,
      })
      .from(buildingMembers)
      .innerJoin(user, eq(user.id, buildingMembers.userId))
      .leftJoin(apartmentResidents, eq(apartmentResidents.userId, buildingMembers.userId))
      .leftJoin(
        apartments,
        and(
          eq(apartments.id, apartmentResidents.apartmentId),
          eq(apartments.buildingId, buildingMembers.buildingId),
        ),
      )
      .where(eq(buildingMembers.buildingId, buildingId))
      .groupBy(buildingMembers.id, user.id)
      .having(
        term
          ? or(
              ilike(user.name, term.contains),
              ilike(user.email, term.contains),
              sql`bool_or(lower(${apartments.number}) = lower(${term.text}))`,
            )
          : undefined,
      )
      // By the name as shown: someone without one sorts by their email (see `displayName`).
      .orderBy(sql`lower(coalesce(nullif(trim(${user.name}), ''), ${user.email}))`, user.id)
    return z.array(personRow).parse(rows)
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to load the people', { area: 'data/members', buildingId, err })
    throw new Error('Failed to load the people')
  }
}
