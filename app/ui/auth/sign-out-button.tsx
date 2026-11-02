import { getLocale, getTranslations } from 'next-intl/server'
import { signOut } from '@/app/lib/actions/auth'
import SubmitButton from '@/app/ui/submit-button'

export default async function SignOutButton() {
  const locale = await getLocale()
  const t = await getTranslations('Auth')

  return (
    <form action={signOut.bind(null, locale)}>
      <SubmitButton variant="secondary" pendingLabel={t('signingOut')}>
        {t('signOut')}
      </SubmitButton>
    </form>
  )
}
