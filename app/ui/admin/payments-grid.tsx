import clsx from 'clsx'
import type { getTranslations } from 'next-intl/server'
import type { GridRow } from '@/app/lib/definitions'
import { formatMonthShort } from '@/app/lib/utils/dates'
import GridStatus from '@/app/ui/admin/grid-status'
import LinkPending from '@/app/ui/nav/link-pending'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'

type Props = {
  year: number
  /** The twelve months shown, January first. */
  months: string[]
  currentMonth: string
  rows: GridRow[]
  /** The apartment whose payments are open, if any. */
  selectedId: string | null
  /** Where an apartment's link goes: this page with that apartment open. */
  hrefFor: (apartmentId: string) => string
  t: Awaited<ReturnType<typeof getTranslations<'AdminPayments'>>>
  locale: Locale
}

const captionId = 'payments-grid-caption'

/**
 * The payments grid: one table at every width, one line per apartment. A row's header is its
 * apartment, a link that opens its payments; it stays in view while the months scroll sideways
 * under it, in a region the keyboard can scroll too. Paid and upcoming months are a small mark
 * (their word is for screen readers and the legend), so what is owed stands out and a phone
 * shows half a year at a glance; the current month is tinted and scrolled into view.
 */
export default function PaymentsGrid({
  year,
  months,
  currentMonth,
  rows,
  selectedId,
  hrefFor,
  t,
  locale,
}: Props) {
  // The first column stays put over the months as they scroll under it.
  const sticky = 'sticky start-0 z-10'
  // The current month's column, tinted from top to bottom.
  const current = 'bg-accent/8'

  return (
    <div
      role="region"
      aria-labelledby={captionId}
      // Scrollable from the keyboard when the months do not fit.
      tabIndex={0}
      // Scrolled to, a month stops clear of the sticky apartment column.
      className="border-border scroll-ps-14 overflow-x-auto rounded-b-[inherit] border-t sm:scroll-ps-24"
    >
      <table className="w-full border-collapse">
        <caption id={captionId} className="sr-only">
          {t('tableLabel', { year: String(year) })}
        </caption>
        <thead>
          <tr className="border-border border-b">
            <th
              scope="col"
              className={`${sticky} bg-surface-raised text-text-muted px-2 py-3 text-start text-sm font-medium whitespace-nowrap sm:px-4`}
            >
              <span aria-hidden className="sm:hidden">
                {t('apartmentColumnShort')}
              </span>
              <span className="max-sm:sr-only">{t('apartmentColumn')}</span>
            </th>
            {months.map((month) => (
              <th
                key={month}
                scope="col"
                aria-current={month === currentMonth ? 'date' : undefined}
                className={clsx(
                  'text-text-muted aria-[current=date]:text-text min-w-11 px-0.5 py-3 text-center text-sm font-medium whitespace-nowrap aria-[current=date]:font-semibold xl:min-w-12 xl:px-1',
                  // Where the months start scrolled to, in browsers that support it.
                  month === currentMonth && `${current} [scroll-initial-target:nearest]`,
                )}
              >
                {formatMonthShort(month, locale)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {rows.map((row) => {
            const selected = row.id === selectedId
            return (
              <tr key={row.id} className={clsx(selected && 'bg-surface')}>
                <th
                  scope="row"
                  className={clsx(
                    sticky,
                    selected ? 'bg-surface' : 'bg-surface-raised',
                    'px-1 py-0.5 text-start sm:px-2',
                  )}
                >
                  <Link
                    href={hrefFor(row.id)}
                    aria-label={t('apartment', { number: row.number })}
                    aria-current={selected ? 'true' : undefined}
                    data-select-apartment
                    data-apartment-link={row.id}
                    className="text-accent relative inline-flex min-h-11 min-w-11 items-center px-1 font-semibold whitespace-nowrap underline-offset-4 hover:underline aria-[current=true]:underline sm:px-2"
                  >
                    {row.number}
                    <LinkPending className="end-0 top-2" />
                  </Link>
                </th>
                {row.months.map((status) => (
                  <td
                    key={status.month}
                    className={clsx(
                      'px-0.5 py-1.5 text-center align-middle xl:px-1',
                      status.month === currentMonth && current,
                    )}
                  >
                    <GridStatus status={status} t={t} locale={locale} />
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
