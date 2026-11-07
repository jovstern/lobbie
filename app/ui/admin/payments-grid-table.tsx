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

/**
 * The payments grid as a table, on wide screens; narrower ones get `PaymentsGridCards`. A
 * row's header is its apartment, a link that opens its payments; it stays in view while the
 * months scroll sideways.
 */
export default function PaymentsGridTable({
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

  return (
    <div className="border-border hidden overflow-x-auto rounded-[inherit] border-t lg:block">
      <table className="w-full border-collapse">
        <caption className="sr-only">{t('tableLabel', { year: String(year) })}</caption>
        <thead>
          <tr className="border-border border-b">
            <th
              scope="col"
              className={`${sticky} bg-surface-raised text-text-muted px-4 py-3 text-start text-sm font-medium whitespace-nowrap`}
            >
              {t('apartmentColumn')}
            </th>
            {months.map((month) => (
              <th
                key={month}
                scope="col"
                aria-current={month === currentMonth ? 'date' : undefined}
                className="text-text-muted aria-[current=date]:text-text min-w-16 px-1 py-3 text-center text-sm font-medium whitespace-nowrap aria-[current=date]:font-semibold"
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
                    'px-2 py-2 text-start',
                  )}
                >
                  <Link
                    href={hrefFor(row.id)}
                    aria-label={t('apartment', { number: row.number })}
                    aria-current={selected ? 'true' : undefined}
                    data-select-apartment
                    className="text-accent relative inline-flex min-h-11 min-w-11 items-center px-2 font-semibold whitespace-nowrap underline-offset-4 hover:underline aria-[current=true]:underline"
                  >
                    {row.number}
                    <LinkPending className="end-0 top-2" />
                  </Link>
                </th>
                {row.months.map((status) => (
                  <td key={status.month} className="px-1 py-2 align-top">
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
