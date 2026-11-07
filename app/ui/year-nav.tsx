import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid'
import type { YearRange } from '@/app/lib/definitions'
import { buttonClassName } from '@/app/ui/button-styles'
import LinkPending from '@/app/ui/nav/link-pending'
import { Link } from '@/i18n/navigation'

type Props = {
  year: number
  years: YearRange
  /** This page for another year (`?year=`), keeping the rest of its view. */
  hrefFor: (year: number) => string
  /** The navigation's name, such as "Years". */
  label: string
  /** Each link's name, which contains the year it shows ("Previous year, 2025"). */
  previousLabel: (year: string) => string
  nextLabel: (year: string) => string
}

/** The previous and next years of a page that shows one year (`?year=`), within the years it has. */
export default function YearNav({ year, years, hrefFor, label, previousLabel, nextLabel }: Props) {
  const previous = year > years.first ? year - 1 : null
  const next = year < years.last ? year + 1 : null
  if (previous === null && next === null) return null
  const linkClassName = `${buttonClassName('secondary')} relative px-3 tabular-nums`

  return (
    <nav aria-label={label}>
      <ul className="flex gap-2">
        {previous !== null ? (
          <li>
            <Link
              href={hrefFor(previous)}
              aria-label={previousLabel(String(previous))}
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
              aria-label={nextLabel(String(next))}
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
