import { ScaleIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { getLocale, getTranslations } from 'next-intl/server'
import type { BalanceAdjustment } from '@/app/lib/definitions'
import { formatDate } from '@/app/lib/utils/dates'
import { formatAgorot } from '@/app/lib/utils/money'

type Props = { adjustments: BalanceAdjustment[]; timeZone: string }

/** The fund's corrections, newest first: what, how much, when and by whom. */
export default async function AdjustmentList({ adjustments, timeZone }: Props) {
  const [t, locale] = await Promise.all([getTranslations('AdminBuilding'), getLocale()])

  if (adjustments.length === 0) {
    return (
      <div className="rounded-control bg-surface flex flex-col items-start gap-2 p-4">
        <ScaleIcon aria-hidden className="text-text-muted size-7" />
        <p className="font-semibold">{t('emptyTitle')}</p>
        <p className="text-text-muted">{t('emptyBody')}</p>
      </div>
    )
  }

  return (
    <ul className="divide-border flex flex-col divide-y">
      {adjustments.map((adjustment) => (
        <li key={adjustment.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
          <div className="flex items-baseline justify-between gap-4">
            <p className="min-w-0 font-medium break-words">{adjustment.reason}</p>
            <p
              className={clsx(
                'shrink-0 font-semibold whitespace-nowrap tabular-nums',
                adjustment.amountAgorot > 0 ? 'text-success' : 'text-danger',
              )}
            >
              <span className="sr-only">{t('amount')}: </span>
              {formatAgorot(adjustment.amountAgorot, locale, { signed: true })}
            </p>
          </div>
          <p className="text-text-muted text-sm tabular-nums">
            <span className="sr-only">{t('date')}: </span>
            {formatDate(adjustment.createdAt, timeZone, locale)}
            <span aria-hidden> · </span>
            <span className="sr-only">{t('recordedBy')}: </span>
            {adjustment.recordedByName}
          </p>
        </li>
      ))}
    </ul>
  )
}
