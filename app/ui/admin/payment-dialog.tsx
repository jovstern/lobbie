'use client'

import { BanknotesIcon } from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import type { OpenMonth } from '@/app/lib/definitions'
import { formatAgorot } from '@/app/lib/utils/money'
import { LazyDialogSlot, lazyWithRetry, useLazyDialog } from '@/app/ui/admin/lazy-dialog'
import type { PaymentAction, PaymentRecorded } from '@/app/ui/admin/payment-form'
import { buttonClassName, type ButtonVariant } from '@/app/ui/button-styles'

const PaymentDialogContent = lazyWithRetry(() => import('@/app/ui/admin/payment-dialog-content'))

function preload() {
  void import('@/app/ui/admin/payment-dialog-content')
}

type Props = {
  /** `record` with the locale and the apartment bound. */
  action: PaymentAction
  /** The apartment's number, for the dialog's title and the button's name. */
  number: string
  /** The months a payment can go to, oldest first (`data/payments.forApartment`). */
  months: OpenMonth[]
  /** Today in the building's time zone, `YYYY-MM-DD`. */
  today: string
  /** The earliest date paid, `YYYY-MM-DD`: a year before the apartment's billing starts. */
  firstDay: string
  /** The last month a payment may go to (a year ahead). */
  lastMonth: string
  variant?: ButtonVariant
}

/**
 * "Record a payment" for one apartment, and its dialog, whose content loads on first open
 * (`lazy-dialog`). The apartment is bound: its page, or a row of the payments grid, renders
 * one per apartment. Focus moves into the form, and back to the button on close; what was
 * recorded is announced beside the button, which stays on the page.
 */
export default function PaymentDialog({
  action,
  number,
  months,
  today,
  firstDay,
  lastMonth,
  variant = 'primary',
}: Props) {
  const t = useTranslations('PaymentForm')
  const locale = useLocale()
  // What was last recorded since the dialog last opened, announced again for each one.
  const [recorded, setRecorded] = useState<{ payment: PaymentRecorded; count: number } | null>(null)
  const dialog = useLazyDialog({ preload, onOpen: () => setRecorded(null) })

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        {...dialog.trigger}
        aria-label={t('openLabel', { number })}
        className={buttonClassName(variant)}
      >
        <BanknotesIcon aria-hidden className="size-5" />
        {t('open')}
      </button>
      <LazyDialogSlot dialog={dialog}>
        <PaymentDialogContent
          {...dialog.content}
          action={action}
          number={number}
          months={months}
          today={today}
          firstDay={firstDay}
          lastMonth={lastMonth}
          onRecorded={(payment) => {
            dialog.setOpen(false)
            setRecorded((previous) => ({ payment, count: (previous?.count ?? 0) + 1 }))
          }}
        />
      </LazyDialogSlot>
      <div role="status" aria-live="polite" aria-atomic="true">
        {recorded ? (
          <p key={recorded.count} className="text-success font-medium">
            {t('recorded', {
              amount: formatAgorot(recorded.payment.amountAgorot, locale),
              number: recorded.payment.apartmentNumber,
              count: recorded.payment.months.length,
            })}
          </p>
        ) : null}
      </div>
    </div>
  )
}
