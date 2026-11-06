'use client'

import { PencilSquareIcon, PlusIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { lazy, useRef } from 'react'
import { useAnnouncer } from '@/app/ui/admin/admin-announcer'
import type { ApartmentAction, ApartmentValues } from '@/app/ui/admin/apartment-form'
import { LazyDialogSlot, useLazyDialog } from '@/app/ui/admin/lazy-dialog'
import { buttonClassName, type ButtonVariant } from '@/app/ui/button-styles'

const ApartmentDialogContent = lazy(() => import('@/app/ui/admin/apartment-dialog-content'))

function preload() {
  void import('@/app/ui/admin/apartment-dialog-content')
}

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
 * "Add apartment", or a row's "Edit", and its dialog, whose content loads on first open
 * (`lazy-dialog`). Focus moves into the form, and back to the button on close.
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
  // Read when the dialog closes, to choose where focus goes; not shown, so not state.
  const justSaved = useRef(false)
  const editing = saved !== undefined
  const dialog = useLazyDialog({
    preload,
    onOpen: () => {
      justSaved.current = false
    },
    moveFocusOnClose: () => {
      if (!justSaved.current || !focusHeadingAfterSave) return false
      focusHeading()
      return true
    },
  })

  return (
    <>
      <button
        {...dialog.trigger}
        className={buttonClassName(variant)}
        aria-label={editing ? t('editLabel', { number: saved.number }) : undefined}
      >
        {editing ? (
          <PencilSquareIcon aria-hidden className="size-5" />
        ) : (
          <PlusIcon aria-hidden className="size-5" />
        )}
        {editing ? t('edit') : t('open')}
      </button>
      <LazyDialogSlot mounted={dialog.mounted}>
        <ApartmentDialogContent
          {...dialog.content}
          action={action}
          confirmedAction={confirmedAction}
          saved={saved}
          onSaved={(number) => {
            justSaved.current = true
            dialog.setOpen(false)
            announce(editing ? t('saved', { number }) : t('added', { number }))
          }}
        />
      </LazyDialogSlot>
    </>
  )
}
