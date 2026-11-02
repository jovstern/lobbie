import { getTranslations } from 'next-intl/server'
import { requireMember } from '@/app/lib/authz'
import { getSession } from '@/app/lib/session'
import { cardClassName } from '@/app/ui/card'

/** Read-only until profile editing lands (M2): who is signed in, and in which language. */
export default async function ProfileDetails() {
  // Membership first: someone without a building is sent to /join, as on every app page.
  await requireMember()
  const [session, t] = await Promise.all([getSession(), getTranslations('Profile')])
  // requireMember has already sent anyone signed out to sign-in.
  if (!session) throw new Error('No session for a member')
  const { name, email } = session.user

  return (
    <dl className={cardClassName}>
      <div className="flex flex-col gap-1">
        <dt className="text-text-muted text-sm">{t('name')}</dt>
        <dd className="font-medium">{name.trim() || t('notSet')}</dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-text-muted text-sm">{t('email')}</dt>
        <dd className="font-medium">
          {/* Addresses read left to right, also on the Hebrew page. */}
          <span dir="ltr">{email}</span>
        </dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-text-muted text-sm">{t('language')}</dt>
        <dd className="font-medium">{t('languageName')}</dd>
      </div>
    </dl>
  )
}
