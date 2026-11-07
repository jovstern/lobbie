import { ReceiptPercentIcon } from '@heroicons/react/24/outline'
import { PaperClipIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { useLocale, useTranslations } from 'next-intl'
import type { BuildingExpense } from '@/app/lib/definitions'
import { formatDay } from '@/app/lib/utils/dates'
import { formatAgorot } from '@/app/lib/utils/money'
import { cardClassName } from '@/app/ui/card'

type Props = {
  year: number
  /** The year's expenses that count, newest first. */
  expenses: BuildingExpense[]
}

const cell = 'px-3 py-3 align-top first:ps-0 last:pe-0'
const linkClassName =
  'text-accent inline-flex min-h-11 items-center gap-1 font-medium underline-offset-4 hover:underline'

/**
 * The year's expenses (R19), each with its receipt, which any member of the building opens
 * through `/api/files/[id]` (a PDF downloads): a list on phones, a table from desktop width.
 * Only the expenses that count; the committee sees voided ones on `/admin/expenses`.
 */
export default function BuildingExpenses({ year, expenses }: Props) {
  const t = useTranslations('Balance')
  const tCategories = useTranslations('ExpenseCategories')
  const locale = useLocale()

  function receipt(expense: BuildingExpense) {
    if (!expense.receiptKey) {
      // A dash where a link would be, so the rows with a receipt stand out; read out in words.
      return (
        <span className="text-text-muted">
          <span aria-hidden>–</span>
          <span className="sr-only">{t('noReceipt')}</span>
        </span>
      )
    }
    return (
      // A plain link: the file comes from a Route Handler, not a page.
      <a
        href={`/api/files/${expense.receiptKey}`}
        aria-label={t('receiptLabel', {
          description: expense.description,
          date: formatDay(expense.spentOn, locale),
        })}
        className={linkClassName}
      >
        <PaperClipIcon aria-hidden className="size-4 shrink-0" />
        {t('receipt')}
      </a>
    )
  }

  return (
    <section aria-labelledby="ledger-expenses-title" className={cardClassName}>
      <h3 id="ledger-expenses-title" className="text-lg font-semibold">
        {t('expensesTitle', { year: String(year) })}
      </h3>
      {expenses.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <ReceiptPercentIcon aria-hidden className="text-text-muted size-8" />
          <p className="text-lg font-semibold">{t('noExpensesTitle', { year: String(year) })}</p>
          <p className="text-text-muted max-w-prose text-pretty">{t('noExpensesBody')}</p>
        </div>
      ) : (
        <>
          <ol
            aria-labelledby="ledger-expenses-title"
            className="divide-border flex flex-col divide-y lg:hidden"
          >
            {expenses.map((expense) => (
              <li key={expense.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1">
                  <span className="min-w-0 font-medium break-words">
                    <bdi>{expense.description}</bdi>
                  </span>
                  <span className="font-semibold whitespace-nowrap tabular-nums">
                    {formatAgorot(expense.amountAgorot, locale)}
                  </span>
                </div>
                <p className="text-text-muted text-sm">
                  {tCategories(expense.category)} · {formatDay(expense.spentOn, locale)}
                </p>
                {/* On a phone a row without a receipt ends with its date; it is said in words. */}
                {expense.receiptKey ? (
                  <div>{receipt(expense)}</div>
                ) : (
                  <p className="sr-only">{t('noReceipt')}</p>
                )}
              </li>
            ))}
          </ol>
          <table aria-labelledby="ledger-expenses-title" className="hidden w-full lg:table">
            <thead>
              <tr className="border-border text-text-muted border-b text-sm">
                <th scope="col" className={clsx(cell, 'pt-0 text-start font-medium')}>
                  {t('dateColumn')}
                </th>
                <th scope="col" className={clsx(cell, 'pt-0 text-start font-medium')}>
                  {t('descriptionColumn')}
                </th>
                <th scope="col" className={clsx(cell, 'pt-0 text-start font-medium')}>
                  {t('categoryColumn')}
                </th>
                <th scope="col" className={clsx(cell, 'pt-0 text-end font-medium')}>
                  {t('amountColumn')}
                </th>
                <th scope="col" className={clsx(cell, 'pt-0 text-start font-medium')}>
                  {t('receiptColumn')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <th scope="row" className={clsx(cell, 'text-start font-medium tabular-nums')}>
                    {formatDay(expense.spentOn, locale)}
                  </th>
                  <td className={clsx(cell, 'max-w-80 break-words')}>
                    <bdi>{expense.description}</bdi>
                  </td>
                  <td className={cell}>{tCategories(expense.category)}</td>
                  <td className={clsx(cell, 'text-end font-semibold tabular-nums')}>
                    {formatAgorot(expense.amountAgorot, locale)}
                  </td>
                  <td className={clsx(cell, 'py-0')}>{receipt(expense)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
