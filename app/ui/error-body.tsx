'use client'

import { useLocale, useTranslations } from 'next-intl'
import { withLocalePrefix } from '@/app/lib/utils/redirect'
import { buttonClassName } from '@/app/ui/button-styles'

/**
 * What both error boundaries say: a heading, a line, and a way forward. "Back home" is a plain
 * link: after an error a full page load is the safer way out, and it keeps next-intl's
 * navigation out of every page's first load.
 */
export default function ErrorBody({ retry }: { retry: () => void }) {
  const t = useTranslations()
  const locale = useLocale()

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t('ErrorPage.title')}</h1>
        <p className="text-text-muted">{t('ErrorPage.body')}</p>
      </header>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => retry()} className={buttonClassName('primary')}>
          {t('ErrorPage.retry')}
        </button>
        <a href={withLocalePrefix('/', locale)} className={buttonClassName('secondary')}>
          {t('Common.backHome')}
        </a>
      </div>
    </>
  )
}
