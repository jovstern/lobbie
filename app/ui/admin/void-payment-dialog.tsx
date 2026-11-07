'use client'

import { NoSymbolIcon } from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import { useRef } from 'react'
import { formatMonth } from '@/app/lib/utils/dates'
import { formatAgorot } from '@/app/lib/utils/money'
import { useAnnouncer } from '@/app/ui/admin/admin-announcer'
import { LazyDialogSlot, lazyWithRetry, useLazyDialog } from '@/app/ui/admin/lazy-dialog'
import type { VoidPaymentAction } from '@/app/ui/admin/void-payment-dialog-content'
import { buttonClassName } from '@/app/ui/button-styles'

const VoidPaymentDialogContent = lazyWithRetry(
  () => import('@/app/ui/admin/void-payment-dialog-content'),
)

function preload() {
  void import('@/app/ui/admin/void-payment-dialog-content')
}

type Props = {
  /** `voidPayment` with the locale and the payment bound. */
  action: VoidPaymentAction
  /** The payment's month, `YYYY-MM`, and amount, to name it. */
  month: string
  amountAgorot: number
}

/**
 * A payment's "Void" and its confirmation, which asks why (R15). Once voided the payment stays
 * listed without this button, so focus goes to the page heading and the page's status region
 * says what happened.
 */
export default function VoidPaymentDialog({ action, month, amountAgorot }: Props) {
  const t = useTranslations('VoidPayment')
  const locale = useLocale()
  const { announce, focusHeading } = useAnnouncer()
  // Read when the dialog closes, to choose where focus goes; not shown, so not state.
  const voided = useRef(false)
  const dialog = useLazyDialog({
    preload,
    moveFocusOnClose: () => {
      if (voided.current) focusHeading()
      return voided.current
    },
  })
  const words = { month: formatMonth(month, locale), amount: formatAgorot(amountAgorot, locale) }

  return (
    <>
      <button
        {...dialog.trigger}
        aria-label={t('openLabel', words)}
        className={buttonClassName('secondary')}
      >
        <NoSymbolIcon aria-hidden className="size-5" />
        {t('open')}
      </button>
      <LazyDialogSlot dialog={dialog}>
        <VoidPaymentDialogContent
          {...dialog.content}
          action={action}
          title={t('title', words)}
          description={t('body', words)}
          onVoided={() => {
            voided.current = true
            dialog.setOpen(false)
            announce(t('done', words))
          }}
        />
      </LazyDialogSlot>
    </>
  )
}
