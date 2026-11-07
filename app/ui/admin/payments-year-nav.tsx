import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid'
import type { getTranslations } from 'next-intl/server'
import type { YearRange } from '@/app/lib/definitions'
import { buttonClassName } from '@/app/ui/button-styles'
import LinkPending from '@/app/ui/nav/link-pending'
import { Link } from '@/i18n/navigation'

type Props = {
  year: number
  years: YearRange
  /** This page for another year, keeping the apartment open, if one is. */
  hrefFor: (year: number) => string
  t: Awaited<ReturnType<typeof getTranslations<'AdminPayments'>>>
}

/** The previous and next years of the payments grid (`?year=`), within the years it has. */
export default function PaymentsYearNav({ year, years, hrefFor, t }: Props) {
  const previous = year > years.first ? year - 1 : null
  const next = year < years.last ? year + 1 : null
  if (previous === null && next === null) return null
  const linkClassName = `${buttonClassName('secondary')} relative px-3 tabular-nums`

  return (
    <nav aria-label={t('yearsLabel')}>
      <ul className="flex gap-2">
        {previous !== null ? (
          <li>
            <Link
              href={hrefFor(previous)}
              aria-label={t('previousYear', { year: String(previous) })}
              className={linkClassName}
            >
              <ChevronLeftIcon aria-hidden className="size-5 rtl:-scale-x-100" />
              {previous}
              <LinkPending className="end-1 top-1" />
            </Link>
          </li>
        ) : null}
        {next !== null ? (
          <li>
            <Link
              href={hrefFor(next)}
              aria-label={t('nextYear', { year: String(next) })}
              className={linkClassName}
            >
              {next}
              <ChevronRightIcon aria-hidden className="size-5 rtl:-scale-x-100" />
              <LinkPending className="end-1 top-1" />
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  )
}
