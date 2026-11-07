import { BanknotesIcon } from '@heroicons/react/24/outline'
import { NoSymbolIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { useLocale, useTranslations } from 'next-intl'
import type { ResidentPayment } from '@/app/lib/definitions'
import { formatDate, formatDay, formatMonth } from '@/app/lib/utils/dates'
import { formatAgorot } from '@/app/lib/utils/money'
import { cardClassName } from '@/app/ui/card'

type Props = {
  /** Newest first, voided ones included. */
  payments: ResidentPayment[]
  /** The apartment's number, for the empty state. */
  number: string
  /** The building's, in which a void's instant becomes a date. */
  timeZone: string
}

const cell = 'px-3 py-3 first:ps-0 last:pe-0'

/**
 * Every payment recorded for the apartment: a list on phones, a table from desktop width. A
 * voided payment stays listed, struck through, with the word, when and why; never who recorded
 * or voided it.
 */
export default function PaymentHistory({ payments, number, timeZone }: Props) {
  const t = useTranslations('Money')
  const tMethods = useTranslations('PaymentMethods')
  const locale = useLocale()

  function voidedLine(voided: NonNullable<ResidentPayment['voided']>): string {
    return t('voidedOn', { date: formatDate(voided.at, timeZone, locale), reason: voided.reason })
  }

  // Never colour alone: the mark has a word and an icon.
  const voidedMark = (
    <span className="rounded-chip border-border text-text-muted inline-flex w-fit items-center gap-1 border px-2.5 py-0.5 text-sm font-medium">
      <NoSymbolIcon aria-hidden className="size-4" />
      {t('voided')}
    </span>
  )
  const amountClass = (payment: ResidentPayment) =>
    clsx('font-semibold tabular-nums', payment.voided && 'text-text-muted line-through')

  return (
    <section aria-labelledby="money-history-title" className={cardClassName}>
      <h2 id="money-history-title" className="text-lg font-semibold">
        {t('historyTitle')}
      </h2>
      {payments.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <BanknotesIcon aria-hidden className="text-text-muted size-8" />
          <p className="text-lg font-semibold">{t('emptyTitle')}</p>
          <p className="text-text-muted max-w-prose text-pretty">{t('emptyBody', { number })}</p>
        </div>
      ) : (
        <>
          <ol className="divide-border flex flex-col divide-y lg:hidden">
            {payments.map((payment) => (
              <li key={payment.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className={clsx('font-medium', payment.voided && 'text-text-muted')}>
                    {formatMonth(payment.month, locale)}
                  </span>
                  <span className={amountClass(payment)}>
                    {formatAgorot(payment.amountAgorot, locale)}
                  </span>
                </div>
                <p className="text-text-muted text-sm">
                  {t('paidOn', {
                    date: formatDay(payment.paidOn, locale),
                    method: tMethods(payment.method),
                  })}
                </p>
                {payment.voided ? (
                  <div className="flex flex-col items-start gap-1 pt-1">
                    {voidedMark}
                    <p className="text-text-muted text-sm break-words">
                      {voidedLine(payment.voided)}
                    </p>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
          <table aria-labelledby="money-history-title" className="hidden w-full lg:table">
            <thead>
              <tr className="border-border text-text-muted border-b text-sm">
                <th scope="col" className={clsx(cell, 'pt-0 text-start font-medium')}>
                  {t('dateColumn')}
                </th>
                <th scope="col" className={clsx(cell, 'pt-0 text-start font-medium')}>
                  {t('monthColumn')}
                </th>
                <th scope="col" className={clsx(cell, 'pt-0 text-start font-medium')}>
                  {t('methodColumn')}
                </th>
                <th scope="col" className={clsx(cell, 'pt-0 text-end font-medium')}>
                  {t('amountColumn')}
                </th>
                <th scope="col" className={clsx(cell, 'pt-0 text-start font-medium')}>
                  {t('statusColumn')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {payments.map((payment) => (
                <tr key={payment.id} className={clsx(payment.voided && 'text-text-muted')}>
                  <th scope="row" className={clsx(cell, 'text-start font-medium tabular-nums')}>
                    {formatDay(payment.paidOn, locale)}
                  </th>
                  <td className={cell}>{formatMonth(payment.month, locale)}</td>
                  <td className={cell}>{tMethods(payment.method)}</td>
                  <td className={clsx(cell, 'text-end', amountClass(payment))}>
                    {formatAgorot(payment.amountAgorot, locale)}
                  </td>
                  <td className={cell}>
                    {payment.voided ? (
                      <div className="flex flex-col items-start gap-1">
                        {voidedMark}
                        <p className="text-sm break-words">{voidedLine(payment.voided)}</p>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
