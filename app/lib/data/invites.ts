import 'server-only'
import { and, desc, eq, gt, isNull, lt, sql } from 'drizzle-orm'
import { unstable_rethrow } from 'next/navigation'
import { cache } from 'react'
import { z } from 'zod'
import { requireRole } from '@/app/lib/authz'
import { db } from '@/app/lib/db'
import type { ActiveInvite } from '@/app/lib/definitions'
import { previewMiss, previewWait } from '@/app/lib/join-limits'
import { logger } from '@/app/lib/logger'
import { apartments, buildings, invites } from '@/app/lib/schema'
import { hashInviteCode, isInviteCode, normalizeInviteCode } from '@/app/lib/utils/invite-code'
import { inviteStatus, type InvitePreview } from '@/app/lib/utils/join-view'

// Nothing here is cached: invites are per apartment and change with every redemption.

/** An invite that still opens its apartment, by the database's clock. */
export const isActiveInvite = and(
  isNull(invites.revokedAt),
  gt(invites.expiresAt, sql`now()`),
  lt(invites.uses, invites.maxUses),
)

/** Why an invite can or cannot be used, as columns, measured by the database's clock. */
export const inviteFlags = {
  revoked: sql<boolean>`${invites.revokedAt} IS NOT NULL`,
  expired: sql<boolean>`${invites.expiresAt} <= now()`,
  full: sql<boolean>`${invites.uses} >= ${invites.maxUses}`,
}

const previewRow = z.object({
  revoked: z.boolean(),
  expired: z.boolean(),
  full: z.boolean(),
  buildingId: z.string(),
  buildingName: z.string(),
  apartmentId: z.string(),
  apartmentNumber: z.string(),
})

/**
 * The invite a code opens, with its building and apartment, or null for a code that is
 * malformed or unknown. Anyone holding the code may see this: it is the bearer's preview.
 * The code is never logged. Once per request.
 */
export const preview = cache(async (input: string): Promise<InvitePreview | null> => {
  const code = normalizeInviteCode(input)
  if (!isInviteCode(code)) return null
  try {
    const [row] = await db
      .select({
        ...inviteFlags,
        buildingId: buildings.id,
        buildingName: buildings.name,
        apartmentId: apartments.id,
        apartmentNumber: apartments.number,
      })
      .from(invites)
      .innerJoin(
        apartments,
        and(eq(apartments.id, invites.apartmentId), eq(apartments.buildingId, invites.buildingId)),
      )
      .innerJoin(buildings, eq(buildings.id, invites.buildingId))
      .where(eq(invites.codeHash, hashInviteCode(code)))
    if (!row) return null
    const { revoked, expired, full, ...place } = previewRow.parse(row)
    return { status: inviteStatus({ revoked, expired, full }), ...place }
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to load an invite', { area: 'data/invites', route: '/join/[code]', err })
    throw new Error('Failed to load the invite')
  }
})

export type VisitorPreview =
  | { kind: 'rate-limited'; retryAfterSeconds: number }
  | { kind: 'looked-up'; invite: InvitePreview | null }

/**
 * `preview` for the join page, limited per address: a page whose code names no invite counts
 * as a miss, and too many misses show the rate-limited state instead of looking the code up.
 * Codes that name an invite never count, whatever the invite's state.
 */
export async function previewForVisitor(code: string): Promise<VisitorPreview> {
  const retryAfterSeconds = await previewWait()
  if (retryAfterSeconds > 0) return { kind: 'rate-limited', retryAfterSeconds }
  const invite = await preview(code)
  if (!invite) await previewMiss()
  return { kind: 'looked-up', invite }
}

/**
 * The apartment's invite that still works, newest first, or null. Admins only; an apartment of
 * another building has none.
 */
export async function forApartment(apartmentId: string): Promise<ActiveInvite | null> {
  const { buildingId } = await requireRole('admin')
  if (!z.uuid().safeParse(apartmentId).success) return null
  try {
    const [row] = await db
      .select({
        id: invites.id,
        uses: invites.uses,
        maxUses: invites.maxUses,
        expiresAt: invites.expiresAt,
      })
      .from(invites)
      .where(
        and(
          eq(invites.apartmentId, apartmentId),
          eq(invites.buildingId, buildingId),
          isActiveInvite,
        ),
      )
      .orderBy(desc(invites.createdAt))
      .limit(1)
    return row ?? null
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to load the apartment’s invite', {
      area: 'data/invites',
      buildingId,
      apartmentId,
      err,
    })
    throw new Error('Failed to load the invite')
  }
}
