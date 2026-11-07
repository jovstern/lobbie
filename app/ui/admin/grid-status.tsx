import clsx from 'clsx'
import type { getTranslations } from 'next-intl/server'
import type { GridMonth } from '@/app/lib/definitions'
import { formatAgorot } from '@/app/lib/utils/money'
import { monthStatusLooks } from '@/app/ui/month-status-looks'
import type { Locale } from '@/i18n/routing'

type Props = {
  status: GridMonth
  /** The `AdminPayments` translator, shared by every cell of the grid. */
  t: Awaited<ReturnType<typeof getTranslations<'AdminPayments'>>>
  locale: Locale
}

/**
 * One month of one apartment on the payments grid: its status as an icon and a word, and, when
 * it is paid in part, what is left of it (spec §3: a part payment keeps the status).
 */
export default function GridStatus({ status, t, locale }: Props) {
  const { icon: Icon, label, className } = monthStatusLooks[status.kind]
  const partial = 'remainingAgorot' in status && status.paidAgorot > 0

  return (
    <span className="flex flex-col items-center gap-0.5 text-center text-xs leading-tight">
      <Icon aria-hidden className={clsx('size-5', className)} />
      <span className={clsx('font-medium whitespace-nowrap', className)}>{t(label)}</span>
      {partial ? (
        <span className="text-text-muted tabular-nums">
          {t('left', { amount: formatAgorot(status.remainingAgorot, locale) })}
        </span>
      ) : null}
    </span>
  )
}
