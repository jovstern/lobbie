import { getLocale, getTranslations } from 'next-intl/server'
import type { InviteStanding } from '@/app/lib/utils/invite-standing'
import { formatDate } from '@/app/lib/utils/dates'

type Props = {
  standing: InviteStanding
  /** The building's, in which the expiry date is told. */
  timeZone: string
}

/** How an apartment stands on invites, in words: the apartments list's invite column. */
export default async function InviteStandingText({ standing, timeZone }: Props) {
  const [t, locale] = await Promise.all([getTranslations('AdminApartments'), getLocale()])

  switch (standing.kind) {
    case 'active':
      return (
        <span>{t('inviteActive', { date: formatDate(standing.expiresAt, timeZone, locale) })}</span>
      )
    case 'joined':
      return <span>{t('inviteJoined', { count: standing.residents })}</span>
    case 'used-up':
      return <span>{t('inviteUsedUp')}</span>
    case 'none':
      return <span className="text-text-muted">{t('inviteNone')}</span>
  }
}
