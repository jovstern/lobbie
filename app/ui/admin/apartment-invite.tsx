import { LinkIcon } from '@heroicons/react/24/outline'
import { getLocale, getTranslations } from 'next-intl/server'
import { create, revoke } from '@/app/lib/actions/invites'
import { requireRole } from '@/app/lib/authz'
import { forApartment } from '@/app/lib/data/invites'
import type { Apartment } from '@/app/lib/definitions'
import { formatDate } from '@/app/lib/utils/dates'
import InviteControls from '@/app/ui/admin/invite-controls'
import RevokeInviteDialog from '@/app/ui/admin/revoke-invite-dialog'
import { cardClassName } from '@/app/ui/card'

/**
 * The apartment's invite (R9): the active one's uses and expiry, or none, with create, replace
 * and revoke. Only a hash of the code is stored, so a saved invite's link cannot be shown
 * again; past (revoked or expired) invites are not listed, since nothing can be done with them.
 */
export default async function ApartmentInvite({ apartment }: { apartment: Apartment }) {
  const [member, invite, t, locale] = await Promise.all([
    requireRole('admin'),
    forApartment(apartment.id),
    getTranslations('InviteAdmin'),
    getLocale(),
  ])

  return (
    <section aria-labelledby="invite-title" className={`${cardClassName} max-w-2xl`}>
      <div className="flex flex-col gap-1">
        <h2 id="invite-title" className="flex items-center gap-2 text-lg font-semibold">
          <LinkIcon aria-hidden className="text-text-muted size-5" />
          {t('title')}
        </h2>
        <p className="text-text-muted">{t('lead')}</p>
      </div>
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
      <p className="text-text-muted text-sm">{t('onceNote')}</p>
    </section>
  )
}
