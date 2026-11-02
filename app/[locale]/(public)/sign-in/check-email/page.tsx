import { EnvelopeIcon } from '@heroicons/react/24/outline'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import AuthCard from '@/app/ui/auth/auth-card'
import { Link } from '@/i18n/navigation'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('CheckEmail')
  return { title: t('title'), robots: { index: false } }
}

export default async function CheckEmailPage() {
  const t = await getTranslations('CheckEmail')

  return (
    <AuthCard>
      <EnvelopeIcon aria-hidden className="text-accent size-10" />
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p>{t('body')}</p>
        <p className="text-text-muted">{t('hint')}</p>
      </header>
      <Link
        href="/sign-in"
        className="rounded-control border-text-muted bg-surface-raised text-text hover:bg-surface active:bg-border inline-flex min-h-11 items-center justify-center border px-5 font-medium transition-colors"
      >
        {t('differentEmail')}
      </Link>
    </AuthCard>
  )
}
