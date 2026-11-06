'use client'

import { ExclamationTriangleIcon, UserMinusIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useRef } from 'react'
import type { RemoveResidentState } from '@/app/lib/actions/residents'
import { useAnnouncer } from '@/app/ui/admin/admin-announcer'
import { ConfirmDialogContent, preloadConfirmDialog } from '@/app/ui/admin/confirm-dialog'
import { LazyDialogSlot, useLazyDialog } from '@/app/ui/admin/lazy-dialog'
import { buttonClassName } from '@/app/ui/button-styles'

type Props = {
  /** `removeFromApartment` with the locale, the person and the apartment bound. */
  action: () => Promise<RemoveResidentState>
  name: string
  number: string
  /** Whether this is their last apartment: they leave the building too. */
  leavesBuilding: boolean
}

/**
 * A resident's "Remove" from the apartment and its confirmation, which warns when it takes them
 * out of the building too. Once removed their row leaves the page, so focus goes to the page
 * heading and the status region says what happened.
 */
export default function RemoveResidentDialog({ action, name, number, leavesBuilding }: Props) {
  const t = useTranslations('ResidentsClient')
  const { announce, focusHeading } = useAnnouncer()
  // Read when the dialog closes, to choose where focus goes; not shown, so not state.
  const removed = useRef(false)
  const dialog = useLazyDialog({
    preload: preloadConfirmDialog,
    moveFocusOnClose: () => {
      if (removed.current) focusHeading()
      return removed.current
    },
  })

  return (
    <>
      <button
        {...dialog.trigger}
        aria-label={t('removeLabel', { name, number })}
        className={buttonClassName('secondary')}
      >
        <UserMinusIcon aria-hidden className="size-5" />
        {t('remove')}
      </button>
      <LazyDialogSlot dialog={dialog}>
        <ConfirmDialogContent
          {...dialog.content}
          title={t('removeTitle', { name, number })}
          description={
            leavesBuilding ? (
              <>
                <ExclamationTriangleIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
                {t('leaves', { name })}
              </>
            ) : (
              t('stays', { name })
            )
          }
          descriptionClassName={
            leavesBuilding ? 'text-danger flex items-start gap-2 font-medium' : undefined
          }
          confirm={async () => {
            const state = await action()
            return { message: state.message, done: state.removed === true }
          }}
          onDone={() => {
            removed.current = true
            dialog.setOpen(false)
            announce(t('removed', { name, number }))
          }}
          confirmLabel={t('confirm')}
          pendingLabel={t('removing')}
          cancelLabel={t('cancel')}
        />
      </LazyDialogSlot>
    </>
  )
}
