import { connection } from 'next/server'
import { getLocale } from 'next-intl/server'
import { redeem } from '@/app/lib/actions/invites'
import { getMembership } from '@/app/lib/authz'
import { previewForVisitor } from '@/app/lib/data/invites'
import { normalizeInviteCode } from '@/app/lib/utils/invite-code'
import { joinView, type JoinMembership, type JoinView } from '@/app/lib/utils/join-view'
import { withLocalePrefix } from '@/app/lib/utils/redirect'
import JoinInviteView from '@/app/ui/join/join-invite-view'

type Props = { params: Promise<{ code: string }> }

/**
 * `/join/[code]`: what the invite in the URL opens, for whoever is looking (R9). The code is a
 * bearer secret: it is read here and bound to the action, never logged.
 */
export default async function JoinInvite({ params }: Props) {
  // The visit counts against a rate limit, which reads the clock: never while prerendering.
  await connection()
  const { code: raw } = await params
  const code = normalizeInviteCode(raw)
  const [lookup, membership, locale] = await Promise.all([
    previewForVisitor(code),
    getMembership(),
    getLocale(),
  ])
  const who: JoinMembership =
    membership.status === 'member'
      ? {
          status: 'member',
          buildingId: membership.member.buildingId,
          buildingName: membership.member.buildingName,
          apartmentIds: membership.member.apartmentIds,
        }
      : membership

  const view: JoinView =
    lookup.kind === 'rate-limited'
      ? { kind: 'rate-limited', minutes: Math.ceil(lookup.retryAfterSeconds / 60) }
      : joinView(lookup.invite, who)
  // Back here after the magic link, in this language. Sign-in names the apartment, which this
  // page already shows to whoever holds the link.
  const signInQuery = new URLSearchParams({ next: withLocalePrefix(`/join/${code}`, locale) })
  if (view.kind === 'sign-in') signInQuery.set('apartment', view.apartmentNumber)

  return (
    <JoinInviteView
      view={view}
      redeemAction={redeem.bind(null, { locale, code })}
      signInHref={`/sign-in?${signInQuery}`}
    />
  )
}
