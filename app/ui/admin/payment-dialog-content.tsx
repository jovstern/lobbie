'use client'

import { XMarkIcon } from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import { Dialog } from 'radix-ui'
import { useRef } from 'react'
import type { OpenMonth } from '@/app/lib/definitions'
import { formatMonth } from '@/app/lib/utils/dates'
import type { LazyDialogProps } from '@/app/ui/admin/lazy-dialog'
import PaymentForm, { type PaymentAction, type PaymentRecorded } from '@/app/ui/admin/payment-form'
import { buttonClassName } from '@/app/ui/button-styles'

type Props = LazyDialogProps & {
  action: PaymentAction
  number: string
  months: OpenMonth[]
  today: string
  /** The last month a payment may go to, named when none is left to pay. */
  lastMonth: string
  onRecorded: (recorded: PaymentRecorded) => void
}

/**
 * `PaymentDialog`'s dialog, loaded on first open. Radix traps focus inside and closes on
 * Escape. The form unmounts on close, so each opening starts afresh from what is owed.
 */
export default function PaymentDialogContent({
  open,
  onOpenChange,
  onCloseAutoFocus,
  action,
  number,
  months,
  today,
  lastMonth,
  onRecorded,
}: Props) {
  const t = useTranslations('PaymentForm')
  const locale = useLocale()
  const contentRef = useRef<HTMLDivElement>(null)
  const close = (
    <Dialog.Close type="button" className={buttonClassName('secondary')}>
      {t('cancel')}
    </Dialog.Close>
  )

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-scrim data-[state=open]:animate-fade-in fixed inset-0 z-30" />
        <Dialog.Content
          ref={contentRef}
          // The first month, not the close button: the form is what the dialog is for.
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            contentRef.current?.querySelector<HTMLElement>('form input, form select')?.focus()
          }}
          onCloseAutoFocus={onCloseAutoFocus}
          className="rounded-card border-border bg-surface-raised shadow-card data-[state=open]:animate-dialog-in fixed inset-x-4 top-1/2 z-40 mx-auto flex max-h-[calc(100dvh-2rem)] max-w-lg -translate-y-1/2 flex-col gap-5 overflow-y-auto border p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="text-xl font-semibold">
                {t('title', { number })}
              </Dialog.Title>
              <Dialog.Description className="text-text-muted">
                {t('description')}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label={t('close')}
              className="rounded-control text-text-muted hover:bg-surface hover:text-text -me-2 -mt-2 flex size-11 shrink-0 items-center justify-center transition-[background-color,color]"
            >
              <XMarkIcon aria-hidden className="size-6" />
            </Dialog.Close>
          </div>
          {months.length > 0 ? (
            <PaymentForm
              action={action}
              months={months}
              today={today}
              onRecorded={onRecorded}
              cancel={close}
            />
          ) : (
            <>
              <p>{t('nothingOpen', { month: formatMonth(lastMonth, locale) })}</p>
              <div className="flex justify-end">{close}</div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
