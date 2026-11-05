import { LanguageIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import SignOutButton from '@/app/ui/auth/sign-out-button'
import LanguageSwitch from '@/app/ui/nav/language-switch'
import LanguageSwitchLink from '@/app/ui/nav/language-switch-link'
import MoreAdminLink from '@/app/ui/nav/more-admin-link'
import MoreLink from '@/app/ui/nav/more-link'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('More')
  return { title: t('title') }
}

// The phone menu. It also works on desktop, where the side nav links to it: a redirect by
// screen width would need client code and would break shared links and the back button.
export default async function MorePage() {
  const t = await getTranslations('More')

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <ul className="rounded-card border-border bg-surface-raised shadow-card divide-border flex flex-col divide-y border p-2">
        <MoreLink href="/profile" icon={<UserCircleIcon />}>
          {t('profile')}
        </MoreLink>
        <li className="flex min-h-12 items-center justify-between gap-3 py-1 ps-3 first:pt-0 last:pb-0">
          <span className="flex items-center gap-3 font-medium">
            <LanguageIcon aria-hidden className="text-text-muted size-6" />
            {t('language')}
          </span>
          <Suspense fallback={<LanguageSwitchLink />}>
            <LanguageSwitch />
          </Suspense>
        </li>
        {/* Role-dependent, so it streams in last, where it moves no other row. */}
        <Suspense fallback={null}>
          <MoreAdminLink />
        </Suspense>
      </ul>
      <div>
        <SignOutButton />
      </div>
    </div>
  )
}
