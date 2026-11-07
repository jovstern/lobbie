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

/** Months that ask for attention show their word; the others are a mark, named in the legend. */
const worded = new Set<GridMonth['kind']>(['overdue', 'due'])

/**
 * One month of one apartment on the payments grid: its status as a mark (a CSS mask, so each
 * of the grid's hundreds of cells is a few bytes rather than an inline SVG) and a word, shown
 * for the months owed and read out for the others; and, when it is paid in part, what is left
 * of it (spec §3: a part payment keeps the status).
 */
export default function GridStatus({ status, t, locale }: Props) {
  const { label, className } = monthStatusLooks[status.kind]
  const partial = 'remainingAgorot' in status && status.paidAgorot > 0

  return (
    // Relative, so the read-out word stays inside the grid's scroll region, not past the page.
    <span className="relative flex flex-col items-center gap-0.5 text-xs leading-tight">
      <span aria-hidden className={clsx('status-mark', className)} data-status={status.kind} />
      <span
        className={clsx(
          worded.has(status.kind) ? 'font-medium whitespace-nowrap' : 'sr-only',
          className,
        )}
      >
        {t(label)}
      </span>
      {partial ? (
        <span className="text-text-muted tabular-nums">
          {t('left', { amount: formatAgorot(status.remainingAgorot, locale) })}
        </span>
      ) : null}
    </span>
  )
}
