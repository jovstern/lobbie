import { ChevronRightIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import type { getTranslations } from 'next-intl/server'
import type { GridRow } from '@/app/lib/definitions'
import { formatMonthShort } from '@/app/lib/utils/dates'
import GridStatus from '@/app/ui/admin/grid-status'
import StatusChip from '@/app/ui/home/status-chip'
import LinkPending from '@/app/ui/nav/link-pending'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/routing'

type Props = {
  currentMonth: string
  rows: GridRow[]
  selectedId: string | null
  hrefFor: (apartmentId: string) => string
  t: Awaited<ReturnType<typeof getTranslations<'AdminPayments'>>>
  locale: Locale
}

/**
 * The payments grid on phones and tablets: one card per apartment, its standing beside its
 * name (a link that opens its payments), then its twelve months in a small grid.
 */
export default function PaymentsGridCards({
  currentMonth,
  rows,
  selectedId,
  hrefFor,
  t,
  locale,
}: Props) {
  return (
    <ul className="divide-border border-border flex flex-col divide-y border-t lg:hidden">
      {rows.map((row) => {
        const selected = row.id === selectedId
        return (
          <li key={row.id} className={clsx('px-4 py-4 sm:px-6', selected && 'bg-surface')}>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h3 className="text-base font-semibold">
                  <Link
                    href={hrefFor(row.id)}
                    aria-current={selected ? 'true' : undefined}
                    data-select-apartment
                    className="text-accent relative inline-flex min-h-11 items-center gap-1 underline-offset-4 hover:underline aria-[current=true]:underline"
                  >
                    {t('apartment', { number: row.number })}
                    <ChevronRightIcon aria-hidden className="size-4 rtl:-scale-x-100" />
                    <LinkPending className="-end-2 top-2" />
                  </Link>
                </h3>
                <StatusChip kind={row.standing.kind} />
              </div>
              <ol className="grid grid-cols-4 gap-x-1 gap-y-3 sm:grid-cols-6">
                {row.months.map((status) => (
                  <li
                    key={status.month}
                    aria-current={status.month === currentMonth ? 'date' : undefined}
                    className="rounded-control aria-[current=date]:outline-border flex flex-col items-center gap-1 py-1 aria-[current=date]:outline"
                  >
                    <span className="text-text-muted text-xs">
                      {formatMonthShort(status.month, locale)}
                    </span>
                    <GridStatus status={status} t={t} locale={locale} />
                  </li>
                ))}
              </ol>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
