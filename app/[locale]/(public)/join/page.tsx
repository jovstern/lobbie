import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { lookup } from '@/app/lib/actions/invites'
import { withLocalePrefix } from '@/app/lib/utils/redirect'
import AuthCard from '@/app/ui/auth/auth-card'
import JoinGate from '@/app/ui/auth/join-gate'
import SignOutButton from '@/app/ui/auth/sign-out-button'
import JoinCodeForm from '@/app/ui/join/join-code-form'
import { JoinFormSkeleton } from '@/app/ui/skeletons'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Join')
  return { title: t('title'), robots: { index: false, follow: false }, referrer: 'no-referrer' }
}

// For a signed-in person with no building yet: an invite code typed by hand opens its page.
export default async function JoinPage() {
  const locale = await getLocale()
  const t = await getTranslations('Join')

  return (
    <AuthCard>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-pretty">{t('body')}</p>
      </header>
      <Suspense fallback={<JoinFormSkeleton />}>
        <JoinGate locale={locale} next={withLocalePrefix('/join', locale)}>
          <JoinCodeForm action={lookup.bind(null, locale)} />
          <div className="border-border flex flex-col items-start gap-3 border-t pt-6">
            <p className="text-text-muted text-sm">{t('wrongAccount')}</p>
            <SignOutButton />
          </div>
        </JoinGate>
      </Suspense>
    </AuthCard>
  )
}
