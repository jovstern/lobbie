'use server'

import { and, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { unstable_rethrow } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'
import { authorizeAction } from '@/app/lib/authz'
import { byFloorAndNumber } from '@/app/lib/data/apartments'
import { inviteFlags, isActiveInvite } from '@/app/lib/data/invites'
import { db } from '@/app/lib/db'
import type { CreatedInvite, Member } from '@/app/lib/definitions'
import { requireEnv } from '@/app/lib/env'
import { joinAttempt, joinMiss } from '@/app/lib/join-limits'
import { logger } from '@/app/lib/logger'
import {
  apartmentResidents,
  apartments,
  buildingMembers,
  buildings,
  invites,
} from '@/app/lib/schema'
import { getSession } from '@/app/lib/session'
import { typed } from '@/app/lib/utils/form'
import {
  formatInviteCode,
  generateInviteCode,
  hashInviteCode,
  inviteLink,
  isInviteCode,
  normalizeInviteCode,
} from '@/app/lib/utils/invite-code'
import { inviteStatus, type InviteStatus } from '@/app/lib/utils/join-view'
import { redirect } from '@/i18n/navigation'
import { resolveLocale } from '@/i18n/locale'
import type { Locale } from '@/i18n/routing'

// Invites are read by no cached data (the apartments list counts them uncached), so these
// actions update no tag; they refresh the admin's apartment pages.

const inviteLifetime = sql`now() + interval '14 days'`

async function demoRefusal(locale: Locale): Promise<string> {
  const t = await getTranslations({ locale, namespace: 'Demo' })
  return t('readOnly')
}

function refreshApartments() {
  revalidatePath('/[locale]/admin/apartments', 'page')
  revalidatePath('/[locale]/admin/apartments/[id]', 'page')
}

/** A new code for an apartment: the row to insert (hash only) and what is shown once. */
function newInvite(member: Member, apartment: { id: string; number: string }) {
  const code = generateInviteCode()
  return {
    row: {
      buildingId: member.buildingId,
      apartmentId: apartment.id,
      codeHash: hashInviteCode(code),
      createdBy: member.userId,
      expiresAt: inviteLifetime,
    },
    shown: {
      apartmentId: apartment.id,
      apartmentNumber: apartment.number,
      code: formatInviteCode(code),
      link: inviteLink(requireEnv('BETTER_AUTH_URL'), code),
    } satisfies CreatedInvite,
  }
}

export type CreateInviteState = {
  message?: string | null
  /** The new invite, with its code: shown this once, never stored or logged. */
  created?: CreatedInvite & { inviteId: string }
}

type Creation =
  | { kind: 'created'; invite: CreatedInvite & { inviteId: string } }
  | { kind: 'missing' }
  | { kind: 'active-exists' }

/**
 * A new invite for one apartment of the admin's building (R9). With `replace`, the apartment's
 * active invite is revoked in the same transaction; without it, an active invite is left alone
 * and the admin is told. Admins only.
 */
export async function create(
  locale: string,
  apartmentId: string,
  replace: boolean,
): Promise<CreateInviteState> {
  const lang = resolveLocale(locale)
  const authorization = await authorizeAction('admin', lang)
  if (!authorization.ok) return { message: authorization.message }
  const { member } = authorization

  const t = await getTranslations({ locale: lang, namespace: 'InviteErrors' })
  if (!z.uuid().safeParse(apartmentId).success) return { message: t('apartmentNotFound') }
  if (member.isDemo) return { message: await demoRefusal(lang) }

  let creation: Creation
  try {
    creation = await db.transaction(async (tx): Promise<Creation> => {
      // Locked, so two admins creating at once cannot both leave an active invite.
      const [apartment] = await tx
        .select({ id: apartments.id, number: apartments.number })
        .from(apartments)
        .where(and(eq(apartments.id, apartmentId), eq(apartments.buildingId, member.buildingId)))
        .for('update')
      if (!apartment) return { kind: 'missing' }

      const ofApartment = and(
        eq(invites.apartmentId, apartment.id),
        eq(invites.buildingId, member.buildingId),
        isActiveInvite,
      )
      if (replace) {
        await tx
          .update(invites)
          .set({ revokedAt: sql`now()` })
          .where(ofApartment)
      } else {
        const [active] = await tx.select({ id: invites.id }).from(invites).where(ofApartment)
        if (active) return { kind: 'active-exists' }
      }

      const { row, shown } = newInvite(member, apartment)
      const [saved] = await tx.insert(invites).values(row).returning({ id: invites.id })
      return { kind: 'created', invite: { ...shown, inviteId: saved.id } }
    })
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to create an invite', {
      area: 'actions/invites',
      route: '/admin/apartments/[id]',
      buildingId: member.buildingId,
      apartmentId,
      err,
    })
    return { message: t('createFailed') }
  }

  if (creation.kind === 'missing') return { message: t('apartmentNotFound') }
  if (creation.kind === 'active-exists') return { message: t('activeExists') }

  refreshApartments()
  return { created: creation.invite, message: null }
}

/** Which apartments "Create invites for all" covers. */
export type CreateAllMode = 'missing' | 'all'

export type CreateAllState = {
  message?: string | null
  /** The new links in the list's order: shown this once, never stored or logged. */
  created?: CreatedInvite[]
  /** Apartments left out because they already had an active invite (`missing` mode). */
  skipped?: number
}

/**
 * A fresh invite for every apartment of the admin's building that has no active one
 * (`missing`), or for every apartment, revoking the active ones (`all`), in one transaction
 * (R9). Admins only.
 */
export async function createAll(locale: string, mode: CreateAllMode): Promise<CreateAllState> {
  const lang = resolveLocale(locale)
  const authorization = await authorizeAction('admin', lang)
  if (!authorization.ok) return { message: authorization.message }
  const { member } = authorization

  const t = await getTranslations({ locale: lang, namespace: 'InviteErrors' })
  if (mode !== 'missing' && mode !== 'all') return { message: t('createFailed') }
  if (member.isDemo) return { message: await demoRefusal(lang) }

  let result: { created: CreatedInvite[]; skipped: number }
  try {
    result = await db.transaction(async (tx) => {
      const ofBuilding = eq(invites.buildingId, member.buildingId)
      // Locked like a single create, so no apartment ends up with two active invites.
      const all = await tx
        .select({ id: apartments.id, number: apartments.number })
        .from(apartments)
        .where(eq(apartments.buildingId, member.buildingId))
        .orderBy(...byFloorAndNumber)
        .for('update')

      let targets = all
      if (mode === 'all') {
        await tx
          .update(invites)
          .set({ revokedAt: sql`now()` })
          .where(and(ofBuilding, isActiveInvite))
      } else {
        const active = await tx
          .selectDistinct({ apartmentId: invites.apartmentId })
          .from(invites)
          .where(and(ofBuilding, isActiveInvite))
        const invited = new Set(active.map((row) => row.apartmentId))
        targets = all.filter((apartment) => !invited.has(apartment.id))
      }
      if (targets.length === 0) return { created: [], skipped: all.length }

      const made = targets.map((apartment) => newInvite(member, apartment))
      await tx.insert(invites).values(made.map(({ row }) => row))
      return { created: made.map(({ shown }) => shown), skipped: all.length - targets.length }
    })
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to create invites for all apartments', {
      area: 'actions/invites',
      route: '/admin/apartments',
      buildingId: member.buildingId,
      mode,
      err,
    })
    return { message: t('createFailed') }
  }

  if (result.created.length === 0 && result.skipped === 0) return { message: t('noApartments') }
  refreshApartments()
  return { created: result.created, skipped: result.skipped, message: null }
}

export type RevokeInviteState = {
  message?: string | null
  /** Set once the invite stops working; the dialog closes. */
  revoked?: boolean
}

/** Stops an invite of the admin's building from working (R9). Admins only. */
export async function revoke(locale: string, inviteId: string): Promise<RevokeInviteState> {
  const lang = resolveLocale(locale)
  const authorization = await authorizeAction('admin', lang)
  if (!authorization.ok) return { message: authorization.message }
  const { member } = authorization

  const t = await getTranslations({ locale: lang, namespace: 'InviteErrors' })
  if (!z.uuid().safeParse(inviteId).success) return { message: t('inviteNotFound') }
  if (member.isDemo) return { message: await demoRefusal(lang) }

  try {
    const revoked = await db
      .update(invites)
      .set({ revokedAt: sql`now()` })
      .where(
        and(
          eq(invites.id, inviteId),
          eq(invites.buildingId, member.buildingId),
          sql`${invites.revokedAt} IS NULL`,
        ),
      )
      .returning({ id: invites.id })
    if (revoked.length === 0) return { message: t('inviteNotFound') }
  } catch (err) {
    unstable_rethrow(err)
    logger.error('Failed to revoke an invite', {
      area: 'actions/invites',
      route: '/admin/apartments/[id]',
      buildingId: member.buildingId,
      inviteId,
      err,
    })
    return { message: t('revokeFailed') }
  }

  refreshApartments()
  return { revoked: true, message: null }
}

export type JoinCodeState = {
  /** What was typed, so the field keeps it after an error. */
  code?: string
  error?: string
}

/**
 * `/join`'s code entry: a code that names an invite opens its page, `/join/<code>`, which says
 * whether it can be used. A malformed or unknown code is a field error. Rate-limited.
 */
export async function lookup(
  locale: string,
  _prevState: JoinCodeState,
  formData: FormData,
): Promise<JoinCodeState> {
  const lang = resolveLocale(locale)
  const t = await getTranslations({ locale: lang, namespace: 'JoinErrors' })
  const typedCode = typed(formData, 'code')

  const session = await getSession()
  if (!session) {
    const tAuthz = await getTranslations({ locale: lang, namespace: 'Authz' })
    return { code: typedCode, error: tAuthz('signedOut') }
  }

  const code = normalizeInviteCode(typedCode)
  if (!isInviteCode(code)) return { code: typedCode, error: t('format') }

  try {
    const retryAfterSeconds = await joinAttempt(session.user.id)
    if (retryAfterSeconds > 0) {
      return {
        code: typedCode,
        error: t('rateLimited', { minutes: Math.ceil(retryAfterSeconds / 60) }),
      }
    }
    const [found] = await db
      .select({ id: invites.id })
      .from(invites)
      .where(eq(invites.codeHash, hashInviteCode(code)))
    if (!found) {
      await joinMiss()
      return { code: typedCode, error: t('unknown') }
    }
  } catch (err) {
    unstable_rethrow(err)
    // Never the code: it is a bearer secret.
    logger.error('Failed to look up an invite code', {
      area: 'actions/invites',
      route: '/join',
      err,
    })
    return { code: typedCode, error: t('failed') }
  }

  return redirect({ href: `/join/${code}`, locale: lang })
}

/** The page binds its locale and the code from its URL. */
export type RedeemContext = { locale: string; code: string }

export type RedeemState = { message?: string | null }

type Redemption =
  | { kind: 'joined' | 'already-member' | 'other-building' | 'demo' }
  | { kind: 'refused'; status: Exclude<InviteStatus, 'valid'> | 'invalid' }

/** Ends the transaction without writing anything, with the reason. */
class RedemptionRefused extends Error {
  readonly redemption: Redemption

  constructor(redemption: Redemption) {
    super(redemption.kind)
    this.redemption = redemption
  }
}

/**
 * Joins the signed-in person to the invite's apartment (R9), atomically: the use is taken by a
 * guarded `UPDATE`, so two people cannot both take the last one; then the membership (resident)
 * and the apartment. One building per user: a member of another building is refused and the
 * use given back. Someone already in the apartment goes home without using one. Rate-limited
 * (see join-limits).
 */
export async function redeem(context: RedeemContext): Promise<RedeemState> {
  const locale = resolveLocale(context.locale)
  const t = await getTranslations({ locale, namespace: 'JoinErrors' })

  const session = await getSession()
  if (!session) {
    const tAuthz = await getTranslations({ locale, namespace: 'Authz' })
    return { message: tAuthz('signedOut') }
  }
  const userId = session.user.id
  const code = normalizeInviteCode(context.code)
  if (!isInviteCode(code)) return { message: t('invalid') }
  const codeHash = hashInviteCode(code)

  let redemption: Redemption
  try {
    const retryAfterSeconds = await joinAttempt(userId)
    if (retryAfterSeconds > 0) {
      return { message: t('rateLimited', { minutes: Math.ceil(retryAfterSeconds / 60) }) }
    }

    redemption = await db.transaction(async (tx): Promise<Redemption> => {
      const [taken] = await tx
        .update(invites)
        .set({ uses: sql`${invites.uses} + 1` })
        .where(and(eq(invites.codeHash, codeHash), isActiveInvite))
        .returning({
          apartmentId: invites.apartmentId,
          buildingId: invites.buildingId,
          isDemo: sql<boolean>`(SELECT ${buildings.isDemo} FROM ${buildings} WHERE ${buildings.id} = ${invites.buildingId})`,
        })
      if (!taken) {
        const [flags] = await tx
          .select(inviteFlags)
          .from(invites)
          .where(eq(invites.codeHash, codeHash))
        const status = flags ? inviteStatus(flags) : 'invalid'
        // Used up between the UPDATE and this read counts as full; nothing was written.
        return { kind: 'refused', status: status === 'valid' ? 'full' : status }
      }
      if (taken.isDemo) throw new RedemptionRefused({ kind: 'demo' })

      // A membership made at the same moment elsewhere wins the unique user_id; it is read next.
      await tx
        .insert(buildingMembers)
        .values({ userId, buildingId: taken.buildingId, role: 'resident' })
        .onConflictDoNothing({ target: buildingMembers.userId })
      const [membership] = await tx
        .select({ buildingId: buildingMembers.buildingId })
        .from(buildingMembers)
        .where(eq(buildingMembers.userId, userId))
      if (membership?.buildingId !== taken.buildingId) {
        throw new RedemptionRefused({ kind: 'other-building' })
      }

      const joined = await tx
        .insert(apartmentResidents)
        .values({ userId, apartmentId: taken.apartmentId, isOwner: false })
        .onConflictDoNothing()
        .returning({ userId: apartmentResidents.userId })
      if (joined.length === 0) throw new RedemptionRefused({ kind: 'already-member' })
      return { kind: 'joined' }
    })
    // A code that names no invite may be a guess: it counts against the address.
    if (redemption.kind === 'refused' && redemption.status === 'invalid') await joinMiss()
  } catch (err) {
    if (err instanceof RedemptionRefused) {
      redemption = err.redemption
    } else {
      unstable_rethrow(err)
      // Never the code: it is a bearer secret.
      logger.error('Failed to redeem an invite', {
        area: 'actions/invites',
        route: '/join/[code]',
        userId,
        err,
      })
      return { message: t('failed') }
    }
  }

  switch (redemption.kind) {
    case 'joined':
    case 'already-member':
      // The membership is read uncached on every request (authz), so Home sees it at once.
      return redirect({ href: '/', locale })
    case 'other-building':
      return { message: t('otherBuilding') }
    case 'demo':
      return { message: await demoRefusal(locale) }
    case 'refused':
      return { message: t(redemption.status) }
  }
}
