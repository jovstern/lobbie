import { getLocale, getTranslations } from 'next-intl/server'
import {
  setLocale,
  setShowContact,
  updateCommitteeContact,
  updateProfile,
} from '@/app/lib/actions/users'
import { me } from '@/app/lib/data/users'
import { hasGivenName } from '@/app/lib/utils/display-name'
import { formatPhone } from '@/app/lib/utils/phone'
import { hasRole } from '@/app/lib/utils/roles'
import Card from '@/app/ui/card'
import CommitteeContact from '@/app/ui/profile/committee-contact'
import ContactVisibility from '@/app/ui/profile/contact-visibility'
import LanguageChoice from '@/app/ui/profile/language-choice'
import ProfileForm from '@/app/ui/profile/profile-form'

const shownPhone = (phone: string | null) => (phone ? formatPhone(phone) : '')

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/**
 * `/profile` (R13): the member's details, directory visibility and language, and for the
 * committee the contact they publish for the role. Read from the database on each request.
 * `?welcome=1` is where joining lands someone who has not given a name: the form asks for it.
 */
export default async function ProfileSettings({ searchParams }: Props) {
  // `me` checks the membership first, as every app page does.
  const [profile, locale, t, { welcome }] = await Promise.all([
    me(),
    getLocale(),
    getTranslations('Profile'),
    searchParams,
  ])

  return (
    <div className="flex flex-col gap-6">
      <Card titleId="profile-details-title" title={t('detailsTitle')}>
        <ProfileForm
          action={updateProfile.bind(null, locale)}
          saved={{ name: profile.name, phone: shownPhone(profile.phone) }}
          email={profile.email}
          // Only while the name is still missing: after saving it, the page is the usual one.
          askForName={welcome === '1' && !hasGivenName(profile)}
        />
      </Card>
      <Card titleId="profile-directory-title" title={t('directoryTitle')}>
        <ContactVisibility
          action={setShowContact.bind(null, locale)}
          showContact={profile.showContact}
          hasPhone={profile.phone !== null}
        />
      </Card>
      {/* The target of the language change, which lands back here in the new language. */}
      <div id="language" tabIndex={-1} className="scroll-mt-4 outline-none">
        <Card titleId="profile-language-title" title={t('languageTitle')}>
          <LanguageChoice
            action={setLocale.bind(null, locale)}
            labelledBy="profile-language-title"
          />
        </Card>
      </div>
      {hasRole(profile.role, 'committee') ? (
        <Card titleId="profile-committee-title" title={t('committeeTitle')}>
          <p className="text-text-muted">{t('committeeLead')}</p>
          <dl className="flex flex-col gap-1">
            <dt className="text-sm font-medium">{t('committeeRole')}</dt>
            <dd className="font-medium">{profile.committeeTitle ?? t('committeeRoleNone')}</dd>
            <dd className="text-text-muted text-sm">{t('committeeRoleHint')}</dd>
          </dl>
          <CommitteeContact
            action={updateCommitteeContact.bind(null, locale)}
            saved={{
              committeePhone: shownPhone(profile.committeePhone),
              committeeEmail: profile.committeeEmail ?? '',
            }}
          />
        </Card>
      ) : null}
    </div>
  )
}
