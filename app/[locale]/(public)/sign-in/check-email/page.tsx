import { EnvelopeIcon } from '@heroicons/react/24/outline'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import AuthCard from '@/app/ui/auth/auth-card'
import SentTo from '@/app/ui/auth/sent-to'
import { buttonClassName } from '@/app/ui/button-styles'
import { Link } from '@/i18n/navigation'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('CheckEmail')
  return { title: t('title'), robots: { index: false } }
}

export default async function CheckEmailPage({
  searchParams,
}: PageProps<'/[locale]/sign-in/check-email'>) {
  const t = await getTranslations('CheckEmail')

  return (
    <AuthCard>
      <EnvelopeIcon aria-hidden className="text-accent size-10" />
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        {/* Only the address reads the URL; until it streams in, the general sentence stands. */}
        <Suspense fallback={<p>{t('body')}</p>}>
          <SentTo searchParams={searchParams} />
        </Suspense>
        <p className="text-text-muted">{t('hint')}</p>
      </header>
      <Link href="/sign-in" className={buttonClassName('secondary')}>
        {t('differentEmail')}
      </Link>
    </AuthCard>
  )
}
