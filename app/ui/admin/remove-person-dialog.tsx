'use client'

import { UserMinusIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { AlertDialog } from 'radix-ui'
import { useRef, useState } from 'react'
import type { RemoveMemberState } from '@/app/lib/actions/members'
import { useAnnouncer } from '@/app/ui/admin/admin-announcer'
import ConfirmForm from '@/app/ui/admin/confirm-form'
import { buttonClassName } from '@/app/ui/button-styles'

type Props = {
  /** `removeFromBuilding` with the locale and the person's id bound. */
  action: () => Promise<RemoveMemberState>
  name: string
  /** Whether this is the signed-in admin: then they are the one losing access. */
  isSelf: boolean
}

/**
 * A person's "Remove" and its confirmation, which says what it does: every apartment link and
 * the membership go, the account stays. Once they are gone their row leaves the page, so focus
 * goes to the page heading and the status region says what happened. The server may refuse
 * (the last admin), and says why in the dialog.
 */
export default function RemovePersonDialog({ action, name, isSelf }: Props) {
  const t = useTranslations('PersonRemove')
  const { announce, focusHeading } = useAnnouncer()
  const [open, setOpen] = useState(false)
  // Read when the dialog closes, to choose where focus goes; not shown, so not state.
  const removed = useRef(false)

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger
        aria-label={t('removeLabel', { name })}
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
              {t('title', { name })}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-text-muted">
              {isSelf ? t('selfDescription') : t('description', { name })}
            </AlertDialog.Description>
          </div>
          <ConfirmForm
            action={action}
            isDone={(state) => state.removed === true}
            onDone={() => {
              removed.current = true
              setOpen(false)
              announce(t('removed', { name }))
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
