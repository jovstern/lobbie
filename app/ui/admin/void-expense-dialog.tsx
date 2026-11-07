'use client'

import { NoSymbolIcon } from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import { useRef } from 'react'
import { formatDay } from '@/app/lib/utils/dates'
import { formatAgorot } from '@/app/lib/utils/money'
import { useAnnouncer } from '@/app/ui/admin/admin-announcer'
import { LazyDialogSlot, lazyWithRetry, useLazyDialog } from '@/app/ui/admin/lazy-dialog'
import type { VoidAction } from '@/app/ui/admin/void-dialog-content'
import { buttonClassName } from '@/app/ui/button-styles'

const VoidDialogContent = lazyWithRetry(() => import('@/app/ui/admin/void-dialog-content'))

function preload() {
  void import('@/app/ui/admin/void-dialog-content')
}

type Props = {
  /** `voidExpense` with the locale and the expense bound. */
  action: VoidAction
  /** The expense's description, date (`YYYY-MM-DD`) and amount, to name it. */
  description: string
  spentOn: string
  amountAgorot: number
}

/**
 * An expense's "Void" and its confirmation, which asks why (R18). Once voided the expense stays
 * listed without this button, so focus goes to the page heading and the page's status region
 * says what happened.
 */
export default function VoidExpenseDialog({ action, description, spentOn, amountAgorot }: Props) {
  const t = useTranslations('VoidExpense')
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
  const words = { description, amount: formatAgorot(amountAgorot, locale) }
  // Recurring expenses share a description: the date tells their buttons apart.
  const label = t('openLabel', { ...words, date: formatDay(spentOn, locale) })

  return (
    <>
      <button {...dialog.trigger} aria-label={label} className={buttonClassName('secondary')}>
        <NoSymbolIcon aria-hidden className="size-5" />
        {t('open')}
      </button>
      <LazyDialogSlot dialog={dialog}>
        <VoidDialogContent
          {...dialog.content}
          action={action}
          title={t('title', words)}
          description={t('body', words)}
          labels={{
            reason: t('reason'),
            reasonHint: t('reasonHint'),
            confirm: t('confirm'),
            pending: t('pending'),
            cancel: t('cancel'),
          }}
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
