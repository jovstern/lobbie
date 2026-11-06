import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { create, revoke } from '@/app/lib/actions/invites'
import { requireRole } from '@/app/lib/authz'
import { get } from '@/app/lib/data/apartments'
import { forApartment } from '@/app/lib/data/invites'
import { formatDate } from '@/app/lib/utils/dates'
import InviteControls from '@/app/ui/admin/invite-controls'
import RevokeInviteDialog from '@/app/ui/admin/revoke-invite-dialog'

/**
 * The apartment's invite (R9), inside the page's static Invite card: the active one's uses and
 * expiry, or none, with create, replace and revoke. Only a hash of the code is stored, so a
 * saved invite's link cannot be shown again; past (revoked or expired) invites are not listed,
 * since nothing can be done with them.
 */
export default async function ApartmentInvite({ apartmentId }: { apartmentId: Promise<string> }) {
  const id = await apartmentId
  const [member, apartment, invite, t, locale] = await Promise.all([
    requireRole('admin'),
    get(id),
    forApartment(id),
    getTranslations('InviteAdmin'),
    getLocale(),
  ])
  if (!apartment) notFound()

  // One block, as its placeholder is, so the card's gaps do not change when it streams in. It
  // keeps the height of an active invite (two lines and two rows of buttons on phones, one of
  // each from sm), so neither state moves the note and the residents below it.
  return (
    <div className="flex min-h-53 flex-col gap-4 sm:min-h-32">
      {invite ? (
        <div className="flex flex-col gap-1">
          <p className="font-medium">{t('active')}</p>
          <ul className="text-text-muted flex flex-wrap gap-x-6 gap-y-1">
            <li>
              {/* Only a hash of the code is kept, so there is nothing to show but its shape. */}
              <span aria-hidden dir="ltr" className="tracking-wider">
                •••••-•••••
              </span>
              <span className="sr-only">{t('codeHidden')}</span>
            </li>
            <li className="tabular-nums">
              {t('uses', { uses: invite.uses, max: invite.maxUses })}
            </li>
            <li>{t('expires', { date: formatDate(invite.expiresAt, member.timeZone, locale) })}</li>
          </ul>
        </div>
      ) : (
        <p>{t('none')}</p>
      )}
      <InviteControls
        createAction={create.bind(null, locale, apartment.id, false)}
        replaceAction={create.bind(null, locale, apartment.id, true)}
        number={apartment.number}
        activeInviteId={invite?.id ?? null}
        revoke={
          invite ? (
            <RevokeInviteDialog
              action={revoke.bind(null, locale, invite.id)}
              number={apartment.number}
            />
          ) : null
        }
      />
    </div>
  )
}
