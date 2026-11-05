'use client'

import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { Dialog } from 'radix-ui'
import { useRef, useState } from 'react'
import AdjustmentForm, { type AdjustmentAction } from '@/app/ui/admin/adjustment-form'
import { buttonClassName } from '@/app/ui/button-styles'

/**
 * "Add adjustment" and its dialog. Radix traps focus inside, closes on Escape and returns focus
 * to the button. The form unmounts on close, so each opening starts empty.
 */
export default function AdjustmentDialog({ action }: { action: AdjustmentAction }) {
  const t = useTranslations('AdjustmentForm')
  const [open, setOpen] = useState(false)
  // How many were added since the dialog last opened: each one is announced again.
  const [added, setAdded] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)

  function changeOpen(next: boolean) {
    setOpen(next)
    if (next) setAdded(0)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Dialog.Root open={open} onOpenChange={changeOpen}>
        <Dialog.Trigger className={buttonClassName('secondary')}>
          <PlusIcon aria-hidden className="size-5" />
          {t('open')}
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-scrim data-[state=open]:animate-fade-in fixed inset-0 z-30" />
          <Dialog.Content
            ref={contentRef}
            // The first choice, not the close button: the form is what the dialog is for.
            onOpenAutoFocus={(event) => {
              event.preventDefault()
              contentRef.current
                ?.querySelector<HTMLInputElement>('input[name="direction"]')
                ?.focus()
            }}
            className="rounded-card border-border bg-surface-raised shadow-card data-[state=open]:animate-dialog-in fixed inset-x-4 top-1/2 z-40 mx-auto flex max-h-[calc(100dvh-2rem)] max-w-md -translate-y-1/2 flex-col gap-5 overflow-y-auto border p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <Dialog.Title className="text-xl font-semibold">{t('title')}</Dialog.Title>
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
            <AdjustmentForm
              action={action}
              onAdded={() => {
                setOpen(false)
                setAdded((count) => count + 1)
              }}
              cancel={
                <Dialog.Close type="button" className={buttonClassName('secondary')}>
                  {t('cancel')}
                </Dialog.Close>
              }
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <div role="status" aria-live="polite" aria-atomic="true">
        {added > 0 ? (
          <p key={added} className="text-success font-medium">
            {t('added')}
          </p>
        ) : null}
      </div>
    </div>
  )
}
