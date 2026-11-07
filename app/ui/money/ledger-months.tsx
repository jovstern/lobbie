import clsx from 'clsx'
import { useLocale, useTranslations } from 'next-intl'
import type { LedgerYear } from '@/app/lib/definitions'
import { formatMonth } from '@/app/lib/utils/dates'
import { formatAgorot } from '@/app/lib/utils/money'
import { cardClassName } from '@/app/ui/card'

const cell = 'px-3 py-2 first:ps-0 last:pe-0'

/** The year month by month: what came in (payments) and what went out (expenses). */
export default function LedgerMonths({ year, months }: Pick<LedgerYear, 'year' | 'months'>) {
  const t = useTranslations('Balance')
  const locale = useLocale()
  const amount = (agorot: number) => (
    <span className={clsx(agorot === 0 && 'text-text-muted')}>{formatAgorot(agorot, locale)}</span>
  )

  return (
    <section aria-labelledby="ledger-months-title" className={cardClassName}>
      <h3 id="ledger-months-title" className="text-lg font-semibold">
        {t('monthsTitle')}
      </h3>
      {months.length === 0 ? (
        <p className="text-text-muted">{t('quietYear', { year: String(year) })}</p>
      ) : (
        <table aria-labelledby="ledger-months-title" className="w-full">
          <thead>
            <tr className="border-border text-text-muted border-b text-sm">
              <th scope="col" className={clsx(cell, 'pt-0 text-start font-medium')}>
                {t('monthColumn')}
              </th>
              <th scope="col" className={clsx(cell, 'pt-0 text-end font-medium')}>
                {t('inColumn')}
              </th>
              <th scope="col" className={clsx(cell, 'pt-0 text-end font-medium')}>
                {t('outColumn')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {months.map(({ month, incomeAgorot, expensesAgorot }) => (
              <tr key={month}>
                <th scope="row" className={clsx(cell, 'text-start font-medium')}>
                  {formatMonth(month, locale)}
                </th>
                <td className={clsx(cell, 'text-end tabular-nums')}>{amount(incomeAgorot)}</td>
                <td className={clsx(cell, 'text-end tabular-nums')}>{amount(expensesAgorot)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
