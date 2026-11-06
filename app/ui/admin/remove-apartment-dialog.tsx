'use client'

import { TrashIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { AlertDialog, Dialog } from 'radix-ui'
import { useRef, useState } from 'react'
import type { RemoveApartmentState } from '@/app/lib/actions/apartments'
import { useAnnouncer } from '@/app/ui/admin/admin-announcer'
import ConfirmForm from '@/app/ui/admin/confirm-form'
import { buttonClassName } from '@/app/ui/button-styles'

type Props = {
  /** `remove` with the locale and the apartment's id bound. */
  action: () => Promise<RemoveApartmentState>
  number: string
  /** What stops the removal: a few words for the row, the full reason for the dialog. */
  blocked: { summary: string; reason: string } | null
  /** Unique on the page: the summary's id, which the button points to. */
  reasonId: string
}

const contentClassName =
  'rounded-card border-border bg-surface-raised shadow-card data-[state=open]:animate-dialog-in fixed inset-x-4 top-1/2 z-40 mx-auto flex max-h-[calc(100dvh-2rem)] max-w-md -translate-y-1/2 flex-col gap-5 overflow-y-auto border p-6'

/**
 * A row's "Remove". While something still points at the apartment, a short line beside it says
 * what, and the button opens a dialog with the full reason and what to do; otherwise it asks in
 * an AlertDialog, whose Cancel has the focus.
 */
export default function RemoveApartmentDialog({ action, number, blocked, reasonId }: Props) {
  const t = useTranslations('ApartmentRemove')
  const { announce, focusHeading } = useAnnouncer()
  const [open, setOpen] = useState(false)
  // Read when the dialog closes: the row, and the button with it, leave the page.
  const removed = useRef(false)
  const label = t('removeLabel', { number })
  const trigger = (
    <>
      <TrashIcon aria-hidden className="size-5" />
      {t('remove')}
    </>
  )

  if (blocked) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Dialog.Root>
          <Dialog.Trigger
            aria-label={label}
            aria-describedby={reasonId}
            className={buttonClassName('secondary')}
          >
            {trigger}
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="bg-scrim data-[state=open]:animate-fade-in fixed inset-0 z-30" />
            <Dialog.Content className={contentClassName}>
              <div className="flex flex-col gap-1">
                <Dialog.Title className="text-xl font-semibold">
                  {t('blockedTitle', { number })}
                </Dialog.Title>
                <Dialog.Description className="text-text-muted">
                  {blocked.reason}
                </Dialog.Description>
              </div>
              <div className="flex justify-end">
                <Dialog.Close className={buttonClassName('primary')}>
                  {t('blockedClose')}
                </Dialog.Close>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <p id={reasonId} className="text-text-muted max-w-xs text-sm">
          {blocked.summary}
        </p>
      </div>
    )
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger aria-label={label} className={buttonClassName('secondary')}>
        {trigger}
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="bg-scrim data-[state=open]:animate-fade-in fixed inset-0 z-30" />
        <AlertDialog.Content
          onCloseAutoFocus={(event) => {
            if (removed.current) {
              event.preventDefault()
              focusHeading()
            }
          }}
          className={contentClassName}
        >
          <div className="flex flex-col gap-1">
            <AlertDialog.Title className="text-xl font-semibold">
              {t('title', { number })}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-text-muted">
              {t('description')}
            </AlertDialog.Description>
          </div>
          {/* Unmounted on close, so a refusal's message does not greet the next opening. */}
          <ConfirmForm
            action={action}
            isDone={(state) => state.removed === true}
            onDone={() => {
              removed.current = true
              setOpen(false)
              announce(t('removed', { number }))
            }}
            confirmLabel={t('confirm')}
            pendingLabel={t('removing')}
            cancel={
              <AlertDialog.Cancel type="button" className={buttonClassName('secondary')}>
                {t('cancel')}
              </AlertDialog.Cancel>
            }
          />
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
