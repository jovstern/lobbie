import 'server-only'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { cache } from 'react'
import { memberForUser } from '@/app/lib/data/members'
import type { Member, Role } from '@/app/lib/definitions'
import { getSession } from '@/app/lib/session'
import { requestPathHeader, safeNextPath, withLocalePrefix } from '@/app/lib/utils/redirect'
import { hasRole } from '@/app/lib/utils/roles'
import { redirect } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'

export type Membership =
  { status: 'signed-out' } | { status: 'no-membership' } | { status: 'member'; member: Member }

/** Who is asking: signed out, signed in without a building, or a member. */
export const getMembership = cache(async (): Promise<Membership> => {
  const session = await getSession()
  if (!session) return { status: 'signed-out' }
  const member = await memberForUser(session.user.id)
  return member ? { status: 'member', member } : { status: 'no-membership' }
})

/**
 * The signed-in member, for pages. Someone signed out goes to sign-in and comes back to
 * this page afterwards; someone without a building goes to /join.
 */
export const requireMember = cache(async (): Promise<Member> => {
  const membership = await getMembership()
  if (membership.status === 'member') return membership.member

  const locale = await getLocale()
  if (membership.status === 'signed-out') {
    const requested = (await headers()).get(requestPathHeader)
    const next = safeNextPath(requested, withLocalePrefix('/', locale))
    return redirect({ href: `/sign-in?${new URLSearchParams({ next })}`, locale })
  }
  return redirect({ href: '/join', locale })
})

/** The member when their role is at least `min`; otherwise a 404, which also hides the page. */
export const requireRole = cache(async (min: Role): Promise<Member> => {
  const member = await requireMember()
  if (!hasRole(member.role, min)) notFound()
  return member
})

export type ActionAuthorization = { ok: true; member: Member } | { ok: false; message: string }

/**
 * For Server Actions: the member when their role is at least `min`, or a message to show.
 * Actions take the locale as an argument because they cannot read the route's.
 */
export async function authorizeAction(min: Role, locale: Locale): Promise<ActionAuthorization> {
  const membership = await getMembership()
  if (membership.status === 'member' && hasRole(membership.member.role, min)) {
    return { ok: true, member: membership.member }
  }
  const t = await getTranslations({ locale, namespace: 'Authz' })
  const reason = {
    'signed-out': 'signedOut',
    'no-membership': 'noMembership',
    member: 'forbidden',
  } as const
  return { ok: false, message: t(reason[membership.status]) }
}
