import 'server-only'
import { and, asc, eq, sql } from 'drizzle-orm'
import { unstable_rethrow } from 'next/navigation'
import { cache } from 'react'
import { z } from 'zod'
import { requireRole } from '@/app/lib/authz'
import { db } from '@/app/lib/db'
import type { Apartment, ApartmentListItem } from '@/app/lib/definitions'
import { logger } from '@/app/lib/logger'
import { isActiveInvite } from '@/app/lib/data/invites'
import { apartmentResidents, apartments, feeRates, invites, payments } from '@/app/lib/schema'

// Not cached: the counts change with writes outside this page (an invite redeemed, a resident
// moved, a payment recorded), and a stale count would offer a removal the server then refuses.
// The page is the admin's alone and the query is one indexed statement.

/**
 * What still points at an apartment, as columns of a query on `apartments`: each a correlated
 * count, so a list of apartments gets every count in the same statement. Voided payments count
 * too: they are history, and the foreign key keeps them.
 */
export const blockerCounts = {
  // Through eq(), which names each column's table: a bare column would be read as the
  // subquery's own, never the outer apartment's.
  residents: sql<number>`(
    SELECT cast(count(*) as integer) FROM ${apartmentResidents}
    WHERE ${eq(apartmentResidents.apartmentId, apartments.id)}
  )`,
  // Only invites that still work: dead ones are deleted with the apartment.
  activeInvites: sql<number>`(
    SELECT cast(count(*) as integer) FROM ${invites}
    WHERE ${and(eq(invites.apartmentId, apartments.id), eq(invites.buildingId, apartments.buildingId), isActiveInvite)}
  )`,
  payments: sql<number>`(
    SELECT cast(count(*) as integer) FROM ${payments}
    WHERE ${and(eq(payments.apartmentId, apartments.id), eq(payments.buildingId, apartments.buildingId))}
  )`,
  feeOverrides: sql<number>`(
    SELECT cast(count(*) as integer) FROM ${feeRates}
    WHERE ${and(eq(feeRates.apartmentId, apartments.id), eq(feeRates.buildingId, apartments.buildingId))}
  )`,
}

/**
 * By floor, then naturally by number: by the number's leading digits as a number (2, 2A, 10),
 * apartments without any last; then by the text, byte by byte, so every database sorts alike.
 */
export const byFloorAndNumber = [
  asc(apartments.floor),
  sql`cast(substring(${apartments.number} from '^[0-9]+') as numeric) nulls last`,
  sql`${apartments.number} collate "C"`,
]

const count = z.coerce.number().int().nonnegative()
const listRow = z.object({
  id: z.string(),
  number: z.string(),
  floor: z.number().int(),
  billingStartMonth: z.string().nullable(),
  residents: count,
  activeInvites: count,
  payments: count,
  feeOverrides: count,
})

/**
 * Every apartment of the admin's building with its blocker counts, in one query, by floor and
 * then naturally by number (2, 2A, 10). Admins only: anyone else gets a 404.
 */
export async function list(): Promise<ApartmentListItem[]> {
  const { buildingId } = await requireRole('admin')
  try {
    const rows = await db
      .select({
        id: apartments.id,
        number: apartments.number,
        floor: apartments.floor,
        billingStartMonth: apartments.billingStartMonth,
        ...blockerCounts,
      })
      .from(apartments)
      .where(eq(apartments.buildingId, buildingId))
      .orderBy(...byFloorAndNumber)
    return z.array(listRow).parse(rows)
  } catch (err) {
    // Next's own signals (such as a prerender that ended) are not failures.
    unstable_rethrow(err)
    logger.error('Failed to load the apartments', { area: 'data/apartments', buildingId, err })
    throw new Error('Failed to load the apartments')
  }
}

/**
 * One apartment of the admin's building, or null when there is no such apartment there (an
 * unknown id, a malformed one, or another building's). Admins only. Once per request: the
 * page's title and its header both read it.
 */
export const get = cache(async (id: string): Promise<Apartment | null> => {
  const { buildingId } = await requireRole('admin')
  // A malformed id would be a Postgres error; it is simply no apartment.
  if (!z.uuid().safeParse(id).success) return null
  try {
    const [row] = await db
      .select({
        id: apartments.id,
        number: apartments.number,
        floor: apartments.floor,
        billingStartMonth: apartments.billingStartMonth,
      })
      .from(apartments)
      .where(and(eq(apartments.id, id), eq(apartments.buildingId, buildingId)))
    return row ?? null
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to load the apartment', {
      area: 'data/apartments',
      buildingId,
      apartmentId: id,
      err,
    })
    throw new Error('Failed to load the apartment')
  }
})
