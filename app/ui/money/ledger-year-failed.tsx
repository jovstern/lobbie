import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { buttonClassName } from '@/app/ui/button-styles'
import { cardClassName } from '@/app/ui/card'
import { Link } from '@/i18n/navigation'

/**
 * The year on `/money/balance` when it could not be read: what happened, and a link that reads
 * the page again. Rendered by the server in the year's place, so the fund card above stays and
 * no client code is needed. The data layer has already logged the error.
 */
export default function LedgerYearFailed({ retryHref }: { retryHref: string }) {
  const t = useTranslations()

  return (
    <section aria-labelledby="ledger-year-failed-title" className={cardClassName}>
      <h2 id="ledger-year-failed-title" className="text-lg font-semibold">
        {t('Balance.yearFailedTitle')}
      </h2>
      <p role="alert" className="text-danger">
        {t('Balance.yearFailed')}
      </p>
      <Link href={retryHref} className={`${buttonClassName('secondary')} self-start`}>
        <ArrowPathIcon aria-hidden className="size-5" />
        {t('ErrorPage.retry')}
      </Link>
    </section>
  )
}
