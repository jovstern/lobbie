import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  HomeModernIcon,
} from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import type { RedeemState } from '@/app/lib/actions/invites'
import type { JoinView } from '@/app/lib/utils/join-view'
import { buttonClassName } from '@/app/ui/button-styles'
import JoinMessage from '@/app/ui/join/join-message'
import RedeemForm from '@/app/ui/join/redeem-form'
import { Link } from '@/i18n/navigation'

type Props = {
  view: JoinView
  /** `redeem` with the locale and the code bound. */
  redeemAction: () => Promise<RedeemState>
  /** Sign-in, coming back to this invite afterwards. */
  signInHref: string
}

const warning = (
  <ExclamationTriangleIcon aria-hidden className="text-warning mt-1 size-6 shrink-0" />
)

/** Every state of `/join/[code]` (spec §6), from `joinView`. */
export default function JoinInviteView({ view, redeemAction, signInHref }: Props) {
  const t = useTranslations('JoinInvite')
  const home = (
    <Link href="/" className={buttonClassName('primary')}>
      {t('goHome')}
    </Link>
  )
  const typeCode = (
    <Link href="/join" className={buttonClassName('secondary')}>
      {t('enterCode')}
    </Link>
  )
  const invitedIcon = <HomeModernIcon aria-hidden className="text-accent mt-1 size-6 shrink-0" />

  switch (view.kind) {
    case 'valid':
    case 'sign-in':
      return (
        <JoinMessage
          icon={invitedIcon}
          title={t('invitedTo', { number: view.apartmentNumber, building: view.buildingName })}
          body={view.kind === 'valid' ? t('validLead') : t('signInLead')}
        >
          {view.kind === 'valid' ? (
            <RedeemForm
              action={redeemAction}
              label={t('join', { number: view.apartmentNumber })}
              pendingLabel={t('joining')}
            />
          ) : (
            <Link href={signInHref} className={buttonClassName('primary')}>
              {t('signIn')}
            </Link>
          )}
        </JoinMessage>
      )
    case 'already-member':
      return (
        <JoinMessage
          icon={<CheckCircleIcon aria-hidden className="text-success mt-1 size-6 shrink-0" />}
          title={t('alreadyTitle', { number: view.apartmentNumber })}
          body={t('alreadyBody', { building: view.buildingName })}
        >
          {home}
        </JoinMessage>
      )
    case 'other-building':
      return (
        <JoinMessage
          icon={warning}
          title={t('otherTitle')}
          body={t('otherBody', { building: view.buildingName })}
        >
          {home}
        </JoinMessage>
      )
    case 'rate-limited':
      return (
        <JoinMessage
          icon={warning}
          title={t('rateLimitedTitle')}
          body={t('rateLimitedBody', { minutes: view.minutes })}
        />
      )
    case 'invalid':
    case 'expired':
    case 'full':
    case 'revoked':
      return (
        <JoinMessage icon={warning} title={t(`${view.kind}Title`)} body={t(`${view.kind}Body`)}>
          {typeCode}
        </JoinMessage>
      )
  }
}
