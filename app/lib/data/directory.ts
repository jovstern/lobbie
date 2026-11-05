import 'server-only'
import { and, eq, exists, ilike, inArray, or, sql, type SQLWrapper } from 'drizzle-orm'
import { unstable_rethrow } from 'next/navigation'
import { z } from 'zod'
import { requireMember } from '@/app/lib/authz'
import { byFloorAndNumber } from '@/app/lib/data/apartments'
import { db } from '@/app/lib/db'
import type { CommitteeMember, DirectoryFloor } from '@/app/lib/definitions'
import { logger } from '@/app/lib/logger'
import { apartmentResidents, apartments, buildingMembers, user } from '@/app/lib/schema'
import { groupByFloor } from '@/app/lib/utils/directory'
import { searchTerm } from '@/app/lib/utils/search'

// Not cached ('use cache'): names and contact choices change with every profile edit, and a
// stale copy could keep showing a number its owner has just hidden.

/** A text column as the page shows it: null when it is empty or only spaces. */
const nonBlank = (column: SQLWrapper) => sql`nullif(trim(${column}), '')`

// Every resident column is null on the row of an apartment no one has joined.
const directoryRow = z
  .object({
    apartmentId: z.string(),
    number: z.string(),
    floor: z.number().int(),
    userId: z.string().nullable(),
    name: z.string().nullable(),
    isOwner: z.boolean().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
  })
  .transform(({ apartmentId, number, floor, userId, name, isOwner, phone, email }) => ({
    apartmentId,
    number,
    floor,
    resident:
      userId === null || name === null
        ? null
        : { userId, name, isOwner: isOwner ?? false, phone, email },
  }))

/**
 * The residents' directory of the member's building (R11), in one query: by floor, then
 * apartment in natural order, then name. A resident's phone and email are selected only when
 * they chose to show them; otherwise the database returns null and the values never leave it.
 * Apartments no one has joined are listed too, with no residents. `q` narrows it to residents
 * whose name contains it, or to the apartment it names exactly (joined or not).
 */
export async function list(q: string): Promise<DirectoryFloor[]> {
  const { buildingId } = await requireMember()
  const term = searchTerm(q)
  try {
    const rows = await db
      .select({
        apartmentId: apartments.id,
        number: apartments.number,
        floor: apartments.floor,
        userId: user.id,
        name: user.name,
        isOwner: apartmentResidents.isOwner,
        phone: sql`CASE WHEN ${buildingMembers.showContact} THEN ${nonBlank(user.phone)} END`,
        email: sql`CASE WHEN ${buildingMembers.showContact} THEN ${user.email} END`,
      })
      .from(apartments)
      // Only residents who are members of this building, checked in the join itself: a
      // resident row alone is not enough, and an apartment without one still has its row.
      .leftJoin(
        apartmentResidents,
        and(
          eq(apartmentResidents.apartmentId, apartments.id),
          exists(
            db
              .select({ one: sql`1` })
              .from(buildingMembers)
              .where(
                and(
                  eq(buildingMembers.userId, apartmentResidents.userId),
                  eq(buildingMembers.buildingId, apartments.buildingId),
                ),
              ),
          ),
        ),
      )
      .leftJoin(
        buildingMembers,
        and(
          eq(buildingMembers.userId, apartmentResidents.userId),
          eq(buildingMembers.buildingId, apartments.buildingId),
        ),
      )
      .leftJoin(user, eq(user.id, apartmentResidents.userId))
      .where(
        and(
          eq(apartments.buildingId, buildingId),
          term
            ? or(
                ilike(user.name, term.contains),
                sql`lower(${apartments.number}) = lower(${term.text})`,
              )
            : undefined,
        ),
      )
      .orderBy(...byFloorAndNumber, apartments.id, sql`lower(${user.name})`, user.id)
    return groupByFloor(z.array(directoryRow).parse(rows))
  } catch (err) {
    // Next's own signals (such as a prerender that ended) are not failures.
    unstable_rethrow(err)
    logger.error('Failed to load the directory', { area: 'data/directory', buildingId, err })
    throw new Error('Failed to load the directory')
  }
}

/**
 * How the chair's title begins, lowercased: the chair leads the committee page. Titles are free
 * text, so the common spellings of the Hebrew abbreviation (gershayim, a double quote or two
 * single ones), the words in full, and "chair" ("Chair", "Chairperson").
 */
export const chairTitlePrefixes = ['יו״ר', 'יו"ר', "יו''ר", 'יושב ראש', 'יושבת ראש', 'chair']

const isChair = sql`lower(trim(${buildingMembers.committeeTitle})) LIKE ANY (ARRAY[${sql.join(
  chairTitlePrefixes.map((prefix) => sql`${`${prefix}%`}`),
  sql`, `,
)}])`

const committeeRow = z.object({
  userId: z.string(),
  name: z.string(),
  role: z.enum(['committee', 'admin']),
  committeeTitle: z.string().nullable(),
  committeePhone: z.string().nullable(),
  committeeEmail: z.string().nullable(),
})

/**
 * The committee and admins of the member's building (R12), in one query, each with the
 * contact they publish for the role. Their personal phone and email are not selected: those
 * belong to the directory and its opt-in. Order: the chair first (see `chairTitlePrefixes`), then
 * admins before committee members, then by name.
 */
export async function committee(): Promise<CommitteeMember[]> {
  const { buildingId } = await requireMember()
  try {
    const rows = await db
      .select({
        userId: user.id,
        name: user.name,
        role: buildingMembers.role,
        committeeTitle: nonBlank(buildingMembers.committeeTitle),
        committeePhone: nonBlank(buildingMembers.committeePhone),
        committeeEmail: nonBlank(buildingMembers.committeeEmail),
      })
      .from(buildingMembers)
      .innerJoin(user, eq(user.id, buildingMembers.userId))
      .where(
        and(
          eq(buildingMembers.buildingId, buildingId),
          inArray(buildingMembers.role, ['committee', 'admin']),
        ),
      )
      .orderBy(
        sql`CASE WHEN ${isChair} THEN 0 ELSE 1 END`,
        // The enum's order is resident < committee < admin.
        sql`${buildingMembers.role} DESC`,
        sql`lower(${user.name})`,
        user.id,
      )
    return z.array(committeeRow).parse(rows)
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to load the committee', { area: 'data/directory', buildingId, err })
    throw new Error('Failed to load the committee')
  }
}
