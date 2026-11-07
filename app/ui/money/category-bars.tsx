import { useLocale, useTranslations } from 'next-intl'
import type { LedgerYear } from '@/app/lib/definitions'
import { formatAgorot, formatShare } from '@/app/lib/utils/money'

type Props = Pick<LedgerYear, 'year' | 'categories' | 'expensesAgorot'>

/**
 * Where the year's money went: each category's amount and share of the expenses, in words,
 * with a bar beside it that only repeats them. The bars are plain CSS, the largest category
 * full width; as blocks, they grow from the start edge in either direction.
 */
export default function CategoryBars({ year, categories, expensesAgorot }: Props) {
  const t = useTranslations('Balance')
  const tCategories = useTranslations('ExpenseCategories')
  const locale = useLocale()
  const largest = categories[0]?.amountAgorot ?? 0

  return (
    <div className="flex flex-col gap-4">
      <h3 id="ledger-categories-title" className="text-text-muted font-medium">
        {t('categoriesTitle')}
      </h3>
      {categories.length === 0 ? (
        <p className="text-text-muted">{t('noExpensesTitle', { year: String(year) })}</p>
      ) : (
        <ul aria-labelledby="ledger-categories-title" className="flex flex-col gap-4">
          {categories.map(({ category, amountAgorot }) => (
            <li key={category} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="font-medium">{tCategories(category)}</span>
                <span className="flex items-baseline gap-2">
                  <span className="font-semibold tabular-nums">
                    {formatAgorot(amountAgorot, locale)}
                  </span>
                  <span className="text-text-muted text-sm tabular-nums">
                    {t('categoryShare', {
                      share: formatShare(amountAgorot, expensesAgorot, locale),
                    })}
                  </span>
                </span>
              </div>
              <div aria-hidden className="rounded-chip bg-border h-2 overflow-hidden">
                <div
                  className="rounded-chip bg-text-muted h-full"
                  // The one value no class can hold: this category against the largest.
                  style={{ width: `${(amountAgorot / largest) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
