import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'
import { requireMember } from '@/app/lib/authz'
import { balance, yearReport } from '@/app/lib/data/ledger'
import type { LedgerYear as LedgerYearReport } from '@/app/lib/definitions'
import { formatAgorot } from '@/app/lib/utils/money'
import { cardClassName } from '@/app/ui/card'
import BuildingExpenses from '@/app/ui/money/building-expenses'
import CategoryBars from '@/app/ui/money/category-bars'
import FundCard from '@/app/ui/money/fund-card'
import LedgerMonths from '@/app/ui/money/ledger-months'
import LedgerYearBoundary from '@/app/ui/money/ledger-year-boundary'
import YearNav from '@/app/ui/year-nav'

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown }

/**
 * `/money/balance` for every member (R19): the fund now, over every year, then one year of it
 * (`?year=`, this year by default): what came in and went out, by category and by month, and
 * the year's expenses with their receipts. Both are read at once; the year has its own error
 * boundary, so if it fails the fund still shows.
 */
export default async function BalanceView({ searchParams }: Props) {
  // A member of a building; anyone else is sent to sign in or to join.
  const [{ buildingId }, { year: requestedYear }] = await Promise.all([
    requireMember(),
    searchParams,
  ])
  const [fund, report] = await Promise.all([
    balance(buildingId),
    // Held, not thrown here: thrown, it would take the fund card down with it.
    yearReport(requestedYear).then(
      (value): Settled<LedgerYearReport> => ({ ok: true, value }),
      (error: unknown): Settled<LedgerYearReport> => ({ ok: false, error }),
    ),
  ])

  return (
    <div className="flex flex-col gap-6 lg:gap-8">
      <FundCard fund={fund} />
      <LedgerYearBoundary>
        {/* Its own Suspense, as React needs one between a server render's error and the
            boundary that catches it on the client; the year is read by now, so it shows at
            once and the fallback never does. */}
        <Suspense fallback={null}>
          <LedgerYear report={report} />
        </Suspense>
      </LedgerYearBoundary>
    </div>
  )
}

/** The year's money; a failed read is thrown here, inside the year's own boundary. */
async function LedgerYear({ report: settled }: { report: Settled<LedgerYearReport> }) {
  if (!settled.ok) throw settled.error
  const report = settled.value
  const [t, locale] = await Promise.all([getTranslations('Balance'), getLocale()])
  const { year } = report
  const totals = [
    { label: t('cameIn'), agorot: report.incomeAgorot },
    { label: t('wentOut'), agorot: report.expensesAgorot },
    // Only when there were any: most years have none.
    ...(report.adjustmentsAgorot === 0
      ? []
      : [{ label: t('adjustments'), agorot: report.adjustmentsAgorot, signed: true }]),
  ]

  return (
    <section aria-labelledby="ledger-year-title" className="flex flex-col gap-4 lg:gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="ledger-year-title" className="text-lg font-semibold">
          {t('yearTitle', { year: String(year) })}
        </h2>
        <YearNav
          year={year}
          years={report.years}
          hrefFor={(other) => `/money/balance?${new URLSearchParams({ year: String(other) })}`}
          label={t('yearsLabel')}
          previousLabel={(other) => t('previousYear', { year: other })}
          nextLabel={(other) => t('nextYear', { year: other })}
        />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-6">
        <div className={cardClassName}>
          <dl className="flex flex-wrap gap-x-8 gap-y-3">
            {totals.map(({ label, agorot, signed }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt className="text-text-muted text-sm">{label}</dt>
                <dd className="text-lg font-semibold tabular-nums">
                  {formatAgorot(agorot, locale, { signed })}
                </dd>
              </div>
            ))}
          </dl>
          <CategoryBars categories={report.categories} expensesAgorot={report.expensesAgorot} />
        </div>
        <LedgerMonths year={year} months={report.months} />
      </div>
      <BuildingExpenses year={year} expenses={report.expenses} />
    </section>
  )
}
