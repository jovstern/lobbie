import { HomeIcon } from '@heroicons/react/24/outline'
import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'

/**
 * The card the public pages share. From 1024 px a warm panel with the app's name sits at the
 * inline-start side; on phones a small wordmark takes its place.
 */
export default async function AuthCard({ children }: { children: ReactNode }) {
  const t = await getTranslations('Auth')

  return (
    <main className="flex min-h-dvh items-center justify-center p-4 sm:p-8">
      <div className="rounded-card border-border bg-surface-raised shadow-card grid w-full max-w-md overflow-hidden border lg:max-w-4xl lg:grid-cols-2">
        <div className="bg-accent text-on-accent relative hidden min-h-112 flex-col justify-end gap-3 overflow-hidden p-10 lg:flex">
          <div
            aria-hidden
            className="rounded-chip bg-on-accent/10 absolute -end-20 -top-20 size-72"
          />
          <div
            aria-hidden
            className="rounded-chip from-on-accent/15 absolute -start-16 top-24 size-40 bg-linear-to-br to-transparent"
          />
          <HomeIcon aria-hidden className="relative mb-2 size-10" />
          <p className="relative text-2xl font-semibold">{t('appName')}</p>
          <p className="relative text-xl font-medium">{t('tagline')}</p>
          <p className="relative max-w-xs">{t('panelDescription')}</p>
        </div>
        <div className="flex flex-col justify-center gap-6 p-6 sm:p-10">
          <p className="text-accent flex items-center gap-2 font-semibold lg:hidden">
            <HomeIcon aria-hidden className="size-6" />
            {t('appName')}
          </p>
          {children}
        </div>
      </div>
    </main>
  )
}
