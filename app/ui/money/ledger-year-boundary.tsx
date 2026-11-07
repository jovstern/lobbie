'use client'

import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { catchError, type ErrorInfo } from 'next/error'
import { useTranslations } from 'next-intl'
import { buttonClassName } from '@/app/ui/button-styles'
import { cardClassName } from '@/app/ui/card'

function LedgerYearFailed({ retry }: { retry: () => void }) {
  const t = useTranslations()

  return (
    <section aria-labelledby="ledger-year-failed-title" className={cardClassName}>
      <h2 id="ledger-year-failed-title" className="text-lg font-semibold">
        {t('Balance.yearFailedTitle')}
      </h2>
      <p role="alert" className="text-danger">
        {t('Balance.yearFailed')}
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className={`${buttonClassName('secondary')} self-start`}
      >
        <ArrowPathIcon aria-hidden className="size-5" />
        {t('ErrorPage.retry')}
      </button>
    </section>
  )
}

/**
 * An error boundary around the year on `/money/balance`, so a failed read of it leaves the fund
 * card and the Money nav in place. `catchError` lets Next's own signals (a redirect, a 404)
 * through, and its `retry` reads the page again. The server has already logged the error.
 */
export default catchError((_props: object, { retry }: ErrorInfo) => (
  <LedgerYearFailed retry={retry} />
))
