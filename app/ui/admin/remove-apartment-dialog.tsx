'use client'

import { TrashIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { AlertDialog } from 'radix-ui'
import { useRef, useState } from 'react'
import type { RemoveApartmentState } from '@/app/lib/actions/apartments'
import { useAnnouncer } from '@/app/ui/admin/admin-announcer'
import ConfirmForm from '@/app/ui/admin/confirm-form'
import { buttonClassName } from '@/app/ui/button-styles'

type Props = {
  /** `remove` with the locale and the apartment's id bound. */
  action: () => Promise<RemoveApartmentState>
  number: string
  /** Why it cannot be removed yet, or null when it can. */
  blockedReason: string | null
  /** Unique on the page: the reason's id, which the button points to. */
  reasonId: string
}

/**
 * A row's "Remove". While something still points at the apartment, the button stays focusable
 * but does nothing, and its description (also shown beside it) says why; otherwise it asks in
 * an AlertDialog, whose Cancel has the focus.
 */
export default function RemoveApartmentDialog({ action, number, blockedReason, reasonId }: Props) {
  const t = useTranslations('ApartmentRemove')
  const { announce, focusHeading } = useAnnouncer()
  const [open, setOpen] = useState(false)
  // Read when the dialog closes: the row, and the button with it, leave the page.
  const removed = useRef(false)
  const label = t('removeLabel', { number })

  if (blockedReason) {
    return (
      <div className="flex flex-col items-start gap-1">
        {/* aria-disabled, not disabled: a disabled button leaves the tab order, and its reason
            with it. */}
        <button
          type="button"
          aria-disabled
          aria-label={label}
          aria-describedby={reasonId}
          className={clsx(
            buttonClassName('secondary'),
            // Nothing to press: no hover or press feedback, only the dimmed look.
            'aria-disabled:hover:bg-surface-raised aria-disabled:active:bg-surface-raised aria-disabled:cursor-not-allowed aria-disabled:opacity-70',
          )}
        >
          <TrashIcon aria-hidden className="size-5" />
          {t('remove')}
        </button>
        <p id={reasonId} className="text-text-muted max-w-xs text-sm">
          {blockedReason}
        </p>
      </div>
    )
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger aria-label={label} className={buttonClassName('secondary')}>
        <TrashIcon aria-hidden className="size-5" />
        {t('remove')}
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
          className="rounded-card border-border bg-surface-raised shadow-card data-[state=open]:animate-dialog-in fixed inset-x-4 top-1/2 z-40 mx-auto flex max-h-[calc(100dvh-2rem)] max-w-md -translate-y-1/2 flex-col gap-5 overflow-y-auto border p-6"
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
