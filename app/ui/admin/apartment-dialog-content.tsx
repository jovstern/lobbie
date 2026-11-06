'use client'

import { XMarkIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { Dialog } from 'radix-ui'
import { useRef } from 'react'
import ApartmentForm, {
  type ApartmentAction,
  type ApartmentValues,
} from '@/app/ui/admin/apartment-form'
import type { LazyDialogProps } from '@/app/ui/admin/lazy-dialog'
import { buttonClassName } from '@/app/ui/button-styles'

type Props = LazyDialogProps & {
  action: ApartmentAction
  confirmedAction?: ApartmentAction
  saved?: ApartmentValues
  onSaved: (number: string) => void
}

/**
 * `ApartmentDialog`'s dialog, loaded on first open. Radix traps focus inside and closes on
 * Escape. The form unmounts on close, so each opening starts from the saved values.
 */
export default function ApartmentDialogContent({
  open,
  onOpenChange,
  onCloseAutoFocus,
  action,
  confirmedAction,
  saved,
  onSaved,
}: Props) {
  const t = useTranslations('ApartmentForm')
  const contentRef = useRef<HTMLDivElement>(null)
  const editing = saved !== undefined

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-scrim data-[state=open]:animate-fade-in fixed inset-0 z-30" />
        <Dialog.Content
          ref={contentRef}
          // The first field, not the close button: the form is what the dialog is for.
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            contentRef.current?.querySelector<HTMLInputElement>('input[name="number"]')?.focus()
          }}
          onCloseAutoFocus={onCloseAutoFocus}
          className="rounded-card border-border bg-surface-raised shadow-card data-[state=open]:animate-dialog-in fixed inset-x-4 top-1/2 z-40 mx-auto flex max-h-[calc(100dvh-2rem)] max-w-md -translate-y-1/2 flex-col gap-5 overflow-y-auto border p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="text-xl font-semibold">
                {editing ? t('editTitle', { number: saved.number }) : t('addTitle')}
              </Dialog.Title>
              <Dialog.Description className="text-text-muted">
                {editing ? t('editDescription') : t('addDescription')}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label={t('close')}
              className="rounded-control text-text-muted hover:bg-surface hover:text-text -me-2 -mt-2 flex size-11 shrink-0 items-center justify-center transition-[background-color,color]"
            >
              <XMarkIcon aria-hidden className="size-6" />
            </Dialog.Close>
          </div>
          <ApartmentForm
            action={action}
            confirmedAction={confirmedAction}
            saved={saved}
            onSaved={onSaved}
            cancel={
              <Dialog.Close type="button" className={buttonClassName('secondary')}>
                {t('cancel')}
              </Dialog.Close>
            }
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
