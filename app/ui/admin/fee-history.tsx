import { CheckCircleIcon, ClockIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { getLocale, getTranslations } from 'next-intl/server'
import type { FeePeriod } from '@/app/lib/definitions'
import { formatDate, formatMonth } from '@/app/lib/utils/dates'
import { formatAgorot } from '@/app/lib/utils/money'

type Props = {
  /** Newest first. */
  periods: FeePeriod[]
  /** The building's time zone, for the dates each fee was set. */
  timeZone: string
}

// Never colour alone: each mark has a word and an icon. Past fees have none.
const marks = {
  // Neutral: a fee in force is a fact, not good news.
  current: {
    icon: CheckCircleIcon,
    label: 'stateCurrent',
    className: 'text-text border-text-muted',
  },
  upcoming: { icon: ClockIcon, label: 'stateUpcoming', className: 'text-text-muted border-border' },
} as const

/**
 * One kind's fees (the building's, or one apartment's), newest first: each amount, the months
 * it covers, whether it is in force now or still to come, and who set it when. An apartment's
 * row without an amount says it follows the building's fee from then.
 */
export default async function FeeHistory({ periods, timeZone }: Props) {
  const [t, locale] = await Promise.all([getTranslations('AdminFees'), getLocale()])

  // A row without an amount is an apartment following the building's fee again.
  const label = (period: FeePeriod, from: string) => {
    const until = period.until ? formatMonth(period.until, locale) : null
    if (period.amountAgorot === null) {
      return until ? t('followedRange', { from, until }) : t('followsFrom', { month: from })
    }
    return until ? t('monthRange', { from, until }) : t('fromMonth', { month: from })
  }

  return (
    <ol className="divide-border flex flex-col divide-y">
      {periods.map((period) => {
        const from = formatMonth(period.effectiveFrom, locale)
        const mark = period.state === 'past' ? null : marks[period.state]
        return (
          <li key={period.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p className={clsx('font-medium', period.state === 'past' && 'text-text-muted')}>
                {label(period, from)}
              </p>
              <div className="flex items-center gap-3">
                {mark ? (
                  <span
                    className={clsx(
                      'rounded-chip inline-flex items-center gap-1 border px-2.5 py-0.5 text-sm font-medium',
                      mark.className,
                    )}
                  >
                    <mark.icon aria-hidden className="size-4" />
                    {t(mark.label)}
                  </span>
                ) : null}
                {period.amountAgorot === null ? null : (
                  <p className="font-semibold whitespace-nowrap tabular-nums">
                    {formatAgorot(period.amountAgorot, locale)}
                  </p>
                )}
              </div>
            </div>
            <p className="text-text-muted text-sm">
              {t('setBy', {
                name: period.setByName,
                date: formatDate(period.setAt, timeZone, locale),
              })}
            </p>
          </li>
        )
      })}
    </ol>
  )
}
