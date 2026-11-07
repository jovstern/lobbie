import { ReceiptPercentIcon } from '@heroicons/react/24/outline'
import { NoSymbolIcon, PaperClipIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { getLocale, getTranslations } from 'next-intl/server'
import { voidExpense } from '@/app/lib/actions/expenses'
import type { AdminExpense } from '@/app/lib/definitions'
import { formatDate, formatDay } from '@/app/lib/utils/dates'
import { formatAgorot } from '@/app/lib/utils/money'
import VoidExpenseDialog from '@/app/ui/admin/void-expense-dialog'

type Props = {
  /** Newest first, voided ones included. */
  expenses: AdminExpense[]
  /** The building's, in which a void's instant becomes a date. */
  timeZone: string
}

const cell = 'px-3 py-3 align-top first:ps-0 last:pe-0'
const linkClassName =
  'text-accent inline-flex min-h-11 items-center gap-1 font-medium underline-offset-4 hover:underline'

/**
 * The building's expenses (R18): a list on phones, a table from desktop width. Each has its
 * receipt, opened through `/api/files/[id]` (a PDF downloads). A voided expense stays listed,
 * struck through, with who voided it, when and why; the others can be voided.
 */
export default async function ExpenseList({ expenses, timeZone }: Props) {
  const [t, tCategories, locale] = await Promise.all([
    getTranslations('AdminExpenses'),
    getTranslations('ExpenseCategories'),
    getLocale(),
  ])

  if (expenses.length === 0) {
    return (
      <div className="rounded-control bg-surface flex flex-col items-start gap-2 p-4">
        <ReceiptPercentIcon aria-hidden className="text-text-muted size-7" />
        <p className="font-semibold">{t('emptyTitle')}</p>
        <p className="text-text-muted">{t('emptyBody')}</p>
      </div>
    )
  }

  function receipt(expense: AdminExpense) {
    if (!expense.receiptKey) return <span className="text-text-muted">{t('noReceipt')}</span>
    const date = formatDay(expense.spentOn, locale)
    return (
      // A plain link: the file comes from a Route Handler, not a page.
      <a
        href={`/api/files/${expense.receiptKey}`}
        aria-label={t('receiptLabel', { description: expense.description, date })}
        className={linkClassName}
      >
        <PaperClipIcon aria-hidden className="size-4 shrink-0" />
        {t('receipt')}
      </a>
    )
  }

  function status(expense: AdminExpense) {
    if (!expense.voided) {
      return (
        <VoidExpenseDialog
          action={voidExpense.bind(null, locale, expense.id)}
          description={expense.description}
          spentOn={expense.spentOn}
          amountAgorot={expense.amountAgorot}
        />
      )
    }
    return (
      <div className="flex flex-col items-start gap-1">
        {/* Never colour alone: the mark has a word and an icon. */}
        <span className="rounded-chip border-border text-text-muted inline-flex w-fit items-center gap-1 border px-2.5 py-0.5 text-sm font-medium">
          <NoSymbolIcon aria-hidden className="size-4" />
          {t('voided')}
        </span>
        <p className="text-text-muted text-sm break-words">
          {t('voidedOn', {
            date: formatDate(expense.voided.at, timeZone, locale),
            name: expense.voided.byName,
            reason: expense.voided.reason,
          })}
        </p>
      </div>
    )
  }

  const amountClass = (expense: AdminExpense) =>
    clsx('font-semibold tabular-nums', expense.voided && 'text-text-muted line-through')

  return (
    <>
      <ol className="divide-border flex flex-col divide-y lg:hidden">
        {expenses.map((expense) => (
          <li key={expense.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span
                className={clsx('font-medium break-words', expense.voided && 'text-text-muted')}
              >
                {expense.description}
              </span>
              <span className={amountClass(expense)}>
                {formatAgorot(expense.amountAgorot, locale)}
              </span>
            </div>
            <p className="text-text-muted text-sm">
              {tCategories(expense.category)} · {formatDay(expense.spentOn, locale)} ·{' '}
              {t('recordedBy', { name: expense.recordedByName })}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              {receipt(expense)}
              {status(expense)}
            </div>
          </li>
        ))}
      </ol>
      <table aria-labelledby="expenses-list-title" className="hidden w-full lg:table">
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
            <th scope="col" className={clsx(cell, 'pt-0 text-start font-medium')}>
              {t('actionsColumn')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {expenses.map((expense) => (
            <tr key={expense.id} className={clsx(expense.voided && 'text-text-muted')}>
              <th scope="row" className={clsx(cell, 'text-start font-medium tabular-nums')}>
                {formatDay(expense.spentOn, locale)}
              </th>
              <td className={clsx(cell, 'max-w-80')}>
                <p className="break-words">{expense.description}</p>
                <p className="text-text-muted text-sm">
                  {t('recordedBy', { name: expense.recordedByName })}
                </p>
              </td>
              <td className={cell}>{tCategories(expense.category)}</td>
              <td className={clsx(cell, 'text-end', amountClass(expense))}>
                {formatAgorot(expense.amountAgorot, locale)}
              </td>
              <td className={clsx(cell, 'py-0')}>{receipt(expense)}</td>
              <td className={cell}>{status(expense)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
