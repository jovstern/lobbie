'use client'

import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

// Rendered inside the app's shell, so navigation stays. The server has already logged the
// error; this offers a way forward.
export default function AppError({ retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations()

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t('ErrorPage.title')}</h1>
        <p className="text-text-muted">{t('ErrorPage.body')}</p>
      </header>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-control bg-accent text-on-accent hover:bg-accent/90 active:bg-accent/80 inline-flex min-h-11 items-center justify-center px-5 font-medium transition-colors"
        >
          {t('ErrorPage.retry')}
        </button>
        <Link
          href="/"
          className="rounded-control border-text-muted bg-surface-raised text-text hover:bg-surface active:bg-border inline-flex min-h-11 items-center justify-center border px-5 font-medium transition-colors"
        >
          {t('Common.backHome')}
        </Link>
      </div>
    </div>
  )
}
