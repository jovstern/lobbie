import { useLocale, useTranslations } from 'next-intl'
import type { BuildingBalance } from '@/app/lib/definitions'
import { formatAgorot } from '@/app/lib/utils/money'
import Card from '@/app/ui/card'

/**
 * The building fund now (R19), the page's focal point, and how it is made: the opening balance,
 * plus the payments and adjustments, less the expenses, over every year.
 */
export default function FundCard({ fund }: { fund: BuildingBalance }) {
  const t = useTranslations('Balance')
  const locale = useLocale()
  const openingOnly =
    fund.paymentsAgorot === 0 && fund.adjustmentsAgorot === 0 && fund.expensesAgorot === 0
  const parts = [
    { label: t('opening'), amount: formatAgorot(fund.openingBalanceAgorot, locale) },
    { label: t('payments'), amount: formatAgorot(fund.paymentsAgorot, locale, { signed: true }) },
    {
      label: t('adjustments'),
      amount: formatAgorot(fund.adjustmentsAgorot, locale, { signed: true }),
    },
    { label: t('expenses'), amount: formatAgorot(-fund.expensesAgorot, locale, { signed: true }) },
  ]

  return (
    <Card titleId="fund-now-title" title={t('nowTitle')} heading="section">
      {/* The title says when: today. */}
      <p className="text-xl font-semibold tabular-nums">{formatAgorot(fund.totalAgorot, locale)}</p>
      {openingOnly ? (
        <p className="text-text-muted max-w-prose text-pretty">{t('openingOnly')}</p>
      ) : (
        <dl className="border-border grid grid-cols-2 gap-x-6 gap-y-3 border-t pt-4 sm:grid-cols-4">
          {parts.map(({ label, amount }) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-text-muted text-sm">{label}</dt>
              <dd className="font-medium tabular-nums">{amount}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  )
}
