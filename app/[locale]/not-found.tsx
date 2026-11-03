import { getTranslations } from 'next-intl/server'
import AuthCard from '@/app/ui/auth/auth-card'
import { buttonClassName } from '@/app/ui/button-styles'
import { Link } from '@/i18n/navigation'

export default async function NotFound() {
  const t = await getTranslations()

  return (
    <AuthCard>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t('NotFound.title')}</h1>
        <p className="text-text-muted">{t('NotFound.description')}</p>
      </header>
      <Link href="/" className={buttonClassName('primary')}>
        {t('Common.backHome')}
      </Link>
    </AuthCard>
  )
}
