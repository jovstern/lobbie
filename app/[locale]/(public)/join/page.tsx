import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { withLocalePrefix } from '@/app/lib/utils/redirect'
import AuthCard from '@/app/ui/auth/auth-card'
import JoinGate from '@/app/ui/auth/join-gate'
import SignOutButton from '@/app/ui/auth/sign-out-button'
import { ButtonSkeleton } from '@/app/ui/skeletons'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Join')
  return { title: t('title'), robots: { index: false } }
}

// For a signed-in person with no building yet. Entering an invite code arrives in M2.
export default async function JoinPage() {
  const locale = await getLocale()
  const t = await getTranslations('Join')

  return (
    <AuthCard>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p>{t('body')}</p>
      </header>
      <Suspense fallback={<ButtonSkeleton />}>
        <JoinGate locale={locale} next={withLocalePrefix('/join', locale)}>
          <SignOutButton />
        </JoinGate>
      </Suspense>
    </AuthCard>
  )
}
