import clsx from 'clsx'
import { useLocale, useTranslations } from 'next-intl'
import type { GridMonth } from '@/app/lib/definitions'
import { formatMonth } from '@/app/lib/utils/dates'
import { formatAgorot } from '@/app/lib/utils/money'
import { cardClassName } from '@/app/ui/card'
import { monthStatusLooks } from '@/app/ui/month-status-looks'

type Props = {
  /** Earlier months still owed, the current year's, then later ones paid ahead; oldest first. */
  months: GridMonth[]
  currentMonth: string
}

/** An apartment's months, each with its status and amount; a part payment shows what's left. */
export default function MonthList({ months, currentMonth }: Props) {
  const t = useTranslations('Money')
  const locale = useLocale()
  const money = (agorot: number) => formatAgorot(agorot, locale)

  function amountOf(status: GridMonth): string | null {
    switch (status.kind) {
      case 'paid':
        return t('paidAmount', { amount: money(status.paidAgorot) })
      case 'due':
      case 'overdue':
      case 'upcoming':
        if (status.paidAgorot > 0) {
          return t('left', { amount: money(status.remainingAgorot), due: money(status.dueAgorot) })
        }
        return status.kind === 'upcoming'
          ? t('fee', { amount: money(status.dueAgorot) })
          : t('toPay', { amount: money(status.dueAgorot) })
      // The word says it all.
      case 'not-billed':
      case 'no-fee':
        return null
    }
  }

  return (
    <section aria-labelledby="money-months-title" className={cardClassName}>
      <h2 id="money-months-title" className="text-lg font-semibold">
        {t('monthsTitle')}
      </h2>
      <ol className="divide-border flex flex-col divide-y">
        {months.map((status) => {
          const { icon: Icon, label, className } = monthStatusLooks[status.kind]
          const isCurrent = status.month === currentMonth
          const amount = amountOf(status)
          return (
            <li
              key={status.month}
              aria-current={isCurrent ? 'date' : undefined}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <span className="flex flex-col">
                <span className="font-medium">{formatMonth(status.month, locale)}</span>
                {isCurrent ? (
                  <span className="text-text-muted text-sm">{t('thisMonth')}</span>
                ) : null}
              </span>
              <span className="flex flex-col items-end gap-0.5 text-end">
                <span className={clsx('inline-flex items-center gap-1.5 font-medium', className)}>
                  <Icon aria-hidden className="size-5 shrink-0" />
                  {t(label)}
                </span>
                {amount ? (
                  <span className="text-text-muted text-sm tabular-nums">{amount}</span>
                ) : null}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
