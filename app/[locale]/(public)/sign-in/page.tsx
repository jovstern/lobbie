import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import AuthCard from '@/app/ui/auth/auth-card'
import SignInSection from '@/app/ui/auth/sign-in-section'
import { SignInFormSkeleton } from '@/app/ui/skeletons'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('SignIn')
  return { title: t('title'), robots: { index: false } }
}

export default async function SignInPage({ searchParams }: PageProps<'/[locale]/sign-in'>) {
  const locale = await getLocale()
  const t = await getTranslations('SignIn')

  return (
    <AuthCard>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t('heading')}</h1>
        <p className="text-text-muted">{t('lead')}</p>
      </header>
      {/* Only this part reads the URL (`next`, `error`); the rest is the static shell. */}
      <Suspense fallback={<SignInFormSkeleton />}>
        <SignInSection searchParams={searchParams} locale={locale} />
      </Suspense>
    </AuthCard>
  )
}
