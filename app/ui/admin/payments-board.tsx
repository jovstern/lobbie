import { HomeModernIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { grid } from '@/app/lib/data/payments'
import { yearMonths } from '@/app/lib/utils/payments'
import ApartmentPayments from '@/app/ui/admin/apartment-payments'
import ArrearsList from '@/app/ui/admin/arrears-list'
import ArrivalHeading from '@/app/ui/admin/arrival-heading'
import CloseApartmentLink from '@/app/ui/admin/close-apartment-link'
import PaymentsGrid from '@/app/ui/admin/payments-grid'
import ReturnFocus from '@/app/ui/admin/return-focus'
import { cardClassName } from '@/app/ui/card'
import EmptyState from '@/app/ui/empty-state'
import { monthStatusLooks } from '@/app/ui/month-status-looks'
import { ApartmentPaymentsSkeleton } from '@/app/ui/skeletons'
import YearNav from '@/app/ui/year-nav'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/** `/admin/payments` with these search params. */
function paymentsHref(params: { year: number; apartment?: string }): string {
  const query = new URLSearchParams({ year: String(params.year) })
  if (params.apartment) query.set('apartment', params.apartment)
  return `/admin/payments?${query}`
}

/**
 * `/admin/payments` below its header (R15, R17): who is behind, every apartment's months of one
 * year (`?year=`), and the payments of the apartment opened from either (`?apartment=`), to
 * record one or void one. The year and the open apartment live in the URL. It streams in after
 * the header: the grid is the page's largest read, and the header need not wait for it.
 */
export default async function PaymentsBoard({ searchParams }: Props) {
  const [params, t, locale] = await Promise.all([
    searchParams,
    getTranslations('AdminPayments'),
    getLocale(),
  ])
  const board = await grid(params.year)
  const { year, rows } = board
  // Only an apartment of the grid opens: anything else in the URL is ignored.
  const selected = rows.find((row) => row.id === params.apartment) ?? null
  const apartmentHref = (apartment: string) => paymentsHref({ year, apartment })
  // The legend names the marks the grid shows, in the order of the looks.
  const shownKinds = new Set(rows.flatMap((row) => row.months.map((month) => month.kind)))
  const legend = Object.entries(monthStatusLooks).filter(([kind]) =>
    shownKinds.has(kind as keyof typeof monthStatusLooks),
  )

  return rows.length === 0 ? (
    <EmptyState icon={HomeModernIcon} title={t('noApartmentsTitle')} body={t('noApartmentsBody')} />
  ) : (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2 xl:gap-6">
        {selected ? (
          <section aria-labelledby="open-apartment-title" className={cardClassName}>
            <div className="flex items-start justify-between gap-4">
              <ArrivalHeading key={selected.id} id="open-apartment-title">
                {t('apartment', { number: selected.number })}
              </ArrivalHeading>
              <CloseApartmentLink
                href={paymentsHref({ year })}
                apartmentId={selected.id}
                label={t('closeLabel', { number: selected.number })}
              />
            </div>
            <Suspense key={selected.id} fallback={<ApartmentPaymentsSkeleton />}>
              <ApartmentPayments apartmentId={Promise.resolve(selected.id)} />
            </Suspense>
          </section>
        ) : (
          <ReturnFocus />
        )}
        <ArrearsList arrears={board.arrears} hrefFor={apartmentHref} />
      </div>
      <section
        aria-labelledby="grid-title"
        className="rounded-card border-border bg-surface-raised shadow-card border"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 id="grid-title" className="text-lg font-semibold">
              {t('gridTitle', { year: String(year) })}
            </h2>
            <p className="text-text-muted">{t('gridLead')}</p>
            <ul
              aria-label={t('legendLabel')}
              className="text-text-muted mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm"
            >
              {legend.map(([kind, look]) => (
                <li key={kind} className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={clsx('status-mark', look.className)}
                    data-status={kind}
                  />
                  {t(look.label)}
                </li>
              ))}
            </ul>
          </div>
          <YearNav
            year={year}
            years={board.years}
            hrefFor={(other) => paymentsHref({ year: other, apartment: selected?.id })}
            label={t('yearsLabel')}
            previousLabel={(other) => t('previousYear', { year: other })}
            nextLabel={(other) => t('nextYear', { year: other })}
          />
        </div>
        <PaymentsGrid
          year={year}
          months={yearMonths(year)}
          currentMonth={board.currentMonth}
          rows={rows}
          selectedId={selected?.id ?? null}
          hrefFor={apartmentHref}
          t={t}
          locale={locale}
        />
      </section>
    </div>
  )
}
