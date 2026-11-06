'use client'

import { TrashIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { lazy, useRef } from 'react'
import type { RemoveApartmentState } from '@/app/lib/actions/apartments'
import { useAnnouncer } from '@/app/ui/admin/admin-announcer'
import { ConfirmDialogContent, preloadConfirmDialog } from '@/app/ui/admin/confirm-dialog'
import { LazyDialogSlot, useLazyDialog } from '@/app/ui/admin/lazy-dialog'
import { buttonClassName } from '@/app/ui/button-styles'

const BlockedDialogContent = lazy(() => import('@/app/ui/admin/blocked-dialog-content'))

function preloadBlocked() {
  void import('@/app/ui/admin/blocked-dialog-content')
}

type Props = {
  /** `remove` with the locale and the apartment's id bound. */
  action: () => Promise<RemoveApartmentState>
  number: string
  /** What stops the removal: a few words for the row, the full reason for the dialog. */
  blocked: { summary: string; reason: string } | null
  /** Unique on the page: the summary's id, which the button points to. */
  reasonId: string
}

/**
 * A row's "Remove". While something still points at the apartment, a short line beside it says
 * what, and the button opens a dialog with the full reason and what to do; otherwise it asks in
 * an AlertDialog, whose Cancel has the focus. Both load on first open (`lazy-dialog`).
 */
export default function RemoveApartmentDialog({ action, number, blocked, reasonId }: Props) {
  const t = useTranslations('ApartmentRemove')
  const { announce, focusHeading } = useAnnouncer()
  // Read when the dialog closes: the row, and the button with it, leave the page.
  const removed = useRef(false)
  const dialog = useLazyDialog({
    preload: blocked ? preloadBlocked : preloadConfirmDialog,
    moveFocusOnClose: () => {
      if (removed.current) focusHeading()
      return removed.current
    },
  })
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
        <button
          {...dialog.trigger}
          aria-label={label}
          aria-describedby={reasonId}
          className={buttonClassName('secondary')}
        >
          {trigger}
        </button>
        <LazyDialogSlot mounted={dialog.mounted}>
          <BlockedDialogContent
            {...dialog.content}
            title={t('blockedTitle', { number })}
            reason={blocked.reason}
            closeLabel={t('blockedClose')}
          />
        </LazyDialogSlot>
        <p id={reasonId} className="text-text-muted max-w-xs text-sm">
          {blocked.summary}
        </p>
      </div>
    )
  }

  return (
    <>
      <button {...dialog.trigger} aria-label={label} className={buttonClassName('secondary')}>
        {trigger}
      </button>
      <LazyDialogSlot mounted={dialog.mounted}>
        <ConfirmDialogContent
          {...dialog.content}
          title={t('title', { number })}
          description={t('description')}
          confirm={async () => {
            const state = await action()
            return { message: state.message, done: state.removed === true }
          }}
          onDone={() => {
            removed.current = true
            dialog.setOpen(false)
            announce(t('removed', { number }))
          }}
          confirmLabel={t('confirm')}
          pendingLabel={t('removing')}
          cancelLabel={t('cancel')}
        />
      </LazyDialogSlot>
    </>
  )
}
