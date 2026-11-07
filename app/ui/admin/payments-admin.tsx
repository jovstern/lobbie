import { HomeModernIcon } from '@heroicons/react/24/outline'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { requireRole } from '@/app/lib/authz'
import { grid } from '@/app/lib/data/payments'
import { yearMonths } from '@/app/lib/utils/payments'
import AdminAnnouncer from '@/app/ui/admin/admin-announcer'
import AdminPageHeader from '@/app/ui/admin/admin-page-header'
import ApartmentPayments from '@/app/ui/admin/apartment-payments'
import ArrearsList from '@/app/ui/admin/arrears-list'
import ArrivalHeading from '@/app/ui/admin/arrival-heading'
import PaymentsGridCards from '@/app/ui/admin/payments-grid-cards'
import PaymentsGridTable from '@/app/ui/admin/payments-grid-table'
import PaymentsYearNav from '@/app/ui/admin/payments-year-nav'
import { cardClassName } from '@/app/ui/card'
import EmptyState from '@/app/ui/empty-state'
import { moneyFont } from '@/app/ui/money-font'
import { ApartmentPaymentsSkeleton } from '@/app/ui/skeletons'

/** The page's heading, which takes focus when the button a dialog opened from is gone. */
const headingId = 'payments-title'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/** `/admin/payments` with these search params. */
function paymentsHref(params: { year: number; apartment?: string }): string {
  const query = new URLSearchParams({ year: String(params.year) })
  if (params.apartment) query.set('apartment', params.apartment)
  return `/admin/payments?${query}`
}

/**
 * `/admin/payments` for the committee and up (R15, R17): who is behind, every apartment's
 * months of one year (`?year=`), and the payments of the apartment opened from either
 * (`?apartment=`), to record one or void one. The year and the open apartment live in the URL.
 */
export default async function PaymentsAdmin({ searchParams }: Props) {
  // The committee and up; anyone else gets the 404, before anything of the building is read.
  await requireRole('committee')
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

  // The header comes after the role check: below the committee the page names nothing.
  return (
    <AdminAnnouncer
      headingId={headingId}
      header={<AdminPageHeader title={t('title')} lead={t('lead')} headingId={headingId} />}
    >
      {rows.length === 0 ? (
        <EmptyState
          icon={HomeModernIcon}
          title={t('noApartmentsTitle')}
          body={t('noApartmentsBody')}
        />
      ) : (
        // Amounts: the font instance that preloads ₪'s file.
        <div className={`${moneyFont.className} flex flex-col gap-6`}>
          <div className="grid items-start gap-4 xl:grid-cols-2 xl:gap-6">
            {selected ? (
              <section aria-labelledby="open-apartment-title" className={cardClassName}>
                <ArrivalHeading key={selected.id} id="open-apartment-title">
                  {t('apartment', { number: selected.number })}
                </ArrivalHeading>
                <Suspense key={selected.id} fallback={<ApartmentPaymentsSkeleton />}>
                  <ApartmentPayments apartmentId={Promise.resolve(selected.id)} />
                </Suspense>
              </section>
            ) : null}
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
              </div>
              <PaymentsYearNav
                year={year}
                years={board.years}
                hrefFor={(other) => paymentsHref({ year: other, apartment: selected?.id })}
                t={t}
              />
            </div>
            <PaymentsGridTable
              year={year}
              months={yearMonths(year)}
              currentMonth={board.currentMonth}
              rows={rows}
              selectedId={selected?.id ?? null}
              hrefFor={apartmentHref}
              t={t}
              locale={locale}
            />
            <PaymentsGridCards
              currentMonth={board.currentMonth}
              rows={rows}
              selectedId={selected?.id ?? null}
              hrefFor={apartmentHref}
              t={t}
              locale={locale}
            />
          </section>
        </div>
      )}
    </AdminAnnouncer>
  )
}
