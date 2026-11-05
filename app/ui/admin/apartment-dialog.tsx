'use client'

import { PencilSquareIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { Dialog } from 'radix-ui'
import { useRef, useState } from 'react'
import { useAnnouncer } from '@/app/ui/admin/admin-announcer'
import ApartmentForm, {
  type ApartmentAction,
  type ApartmentValues,
} from '@/app/ui/admin/apartment-form'
import { buttonClassName, type ButtonVariant } from '@/app/ui/button-styles'

type Props = {
  action: ApartmentAction
  /** Editing: `update` with the billing change confirmed. */
  confirmedAction?: ApartmentAction
  /** Editing: the saved apartment. Without it, the dialog adds one. */
  saved?: ApartmentValues
  variant?: ButtonVariant
  /**
   * After a save, focus goes to the page heading instead of back to the button: the empty
   * state's button is gone once the first apartment is added.
   */
  focusHeadingAfterSave?: boolean
}

/**
 * "Add apartment", or a row's "Edit", and its dialog. Radix traps focus inside, closes on
 * Escape and returns focus to the button. The form unmounts on close, so each opening starts
 * from the saved values.
 */
export default function ApartmentDialog({
  action,
  confirmedAction,
  saved,
  variant = 'secondary',
  focusHeadingAfterSave = false,
}: Props) {
  const t = useTranslations('ApartmentForm')
  const { announce, focusHeading } = useAnnouncer()
  const [open, setOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  // Read when the dialog closes, to choose where focus goes; not shown, so not state.
  const justSaved = useRef(false)
  const editing = saved !== undefined

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) justSaved.current = false
      }}
    >
      <Dialog.Trigger
        className={buttonClassName(variant)}
        aria-label={editing ? t('editLabel', { number: saved.number }) : undefined}
      >
        {editing ? (
          <PencilSquareIcon aria-hidden className="size-5" />
        ) : (
          <PlusIcon aria-hidden className="size-5" />
        )}
        {editing ? t('edit') : t('open')}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-scrim data-[state=open]:animate-fade-in fixed inset-0 z-30" />
        <Dialog.Content
          ref={contentRef}
          // The first field, not the close button: the form is what the dialog is for.
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            contentRef.current?.querySelector<HTMLInputElement>('input[name="number"]')?.focus()
          }}
          onCloseAutoFocus={(event) => {
            if (justSaved.current && focusHeadingAfterSave) {
              event.preventDefault()
              focusHeading()
            }
          }}
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
            onSaved={(number) => {
              justSaved.current = true
              setOpen(false)
              announce(editing ? t('saved', { number }) : t('added', { number }))
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
  )
}
