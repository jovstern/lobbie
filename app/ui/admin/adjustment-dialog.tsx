'use client'

import { PlusIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { AdjustmentAction } from '@/app/ui/admin/adjustment-form'
import { LazyDialogSlot, lazyWithRetry, useLazyDialog } from '@/app/ui/admin/lazy-dialog'
import { buttonClassName } from '@/app/ui/button-styles'

const AdjustmentDialogContent = lazyWithRetry(
  () => import('@/app/ui/admin/adjustment-dialog-content'),
)

function preload() {
  void import('@/app/ui/admin/adjustment-dialog-content')
}

/**
 * "Add adjustment" and its dialog, whose content loads on first open (`lazy-dialog`). Focus
 * moves into the form, and back to the button on close.
 */
export default function AdjustmentDialog({ action }: { action: AdjustmentAction }) {
  const t = useTranslations('AdjustmentForm')
  // How many were added since the dialog last opened: each one is announced again.
  const [added, setAdded] = useState(0)
  const dialog = useLazyDialog({ preload, onOpen: () => setAdded(0) })

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button {...dialog.trigger} className={buttonClassName('secondary')}>
        <PlusIcon aria-hidden className="size-5" />
        {t('open')}
      </button>
      <LazyDialogSlot dialog={dialog}>
        <AdjustmentDialogContent
          {...dialog.content}
          action={action}
          onAdded={() => {
            dialog.setOpen(false)
            setAdded((count) => count + 1)
          }}
        />
      </LazyDialogSlot>
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
