import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

export default async function NotFound() {
  const t = await getTranslations()

  return (
    <main className="mx-auto flex max-w-md flex-col items-start gap-4 p-8">
      <h1 className="text-2xl font-semibold">{t('NotFound.title')}</h1>
      <p className="text-text-muted">{t('NotFound.description')}</p>
      <Link href="/" className="text-accent font-medium underline underline-offset-4">
        {t('Common.backHome')}
      </Link>
    </main>
  )
}
