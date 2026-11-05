'use client'

import { ExclamationTriangleIcon, UserMinusIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { AlertDialog } from 'radix-ui'
import { useRef, useState } from 'react'
import type { RemoveResidentState } from '@/app/lib/actions/residents'
import { useAnnouncer } from '@/app/ui/admin/admin-announcer'
import ConfirmForm from '@/app/ui/admin/confirm-form'
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
  const t = useTranslations('Residents')
  const { announce, focusHeading } = useAnnouncer()
  const [open, setOpen] = useState(false)
  // Read when the dialog closes, to choose where focus goes; not shown, so not state.
  const removed = useRef(false)

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger
        aria-label={t('removeLabel', { name, number })}
        className={buttonClassName('secondary')}
      >
        <UserMinusIcon aria-hidden className="size-5" />
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
              {t('removeTitle', { name, number })}
            </AlertDialog.Title>
            <AlertDialog.Description
              className={
                leavesBuilding
                  ? 'text-danger flex items-start gap-2 font-medium'
                  : 'text-text-muted'
              }
            >
              {leavesBuilding ? (
                <ExclamationTriangleIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
              ) : null}
              {leavesBuilding ? t('leaves', { name }) : t('stays', { name })}
            </AlertDialog.Description>
          </div>
          <ConfirmForm
            action={action}
            isDone={(state) => state.removed === true}
            onDone={() => {
              removed.current = true
              setOpen(false)
              announce(t('removed', { name, number }))
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
