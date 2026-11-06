'use client'

import { NoSymbolIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { AlertDialog } from 'radix-ui'
import { useRef, useState } from 'react'
import type { RevokeInviteState } from '@/app/lib/actions/invites'
import { useAnnouncer } from '@/app/ui/admin/admin-announcer'
import ConfirmForm from '@/app/ui/admin/confirm-form'
import { buttonClassName } from '@/app/ui/button-styles'

type Props = {
  /** `revoke` with the locale and the invite's id bound. */
  action: () => Promise<RevokeInviteState>
  number: string
}

/**
 * "Revoke" and its confirmation. Once the invite is revoked this button leaves the page, so
 * focus goes to the page heading and the status region says what happened.
 */
export default function RevokeInviteDialog({ action, number }: Props) {
  const t = useTranslations('InviteAdminClient')
  const { announce, focusHeading } = useAnnouncer()
  const [open, setOpen] = useState(false)
  // Read when the dialog closes, to choose where focus goes; not shown, so not state.
  const revoked = useRef(false)

  return (
    <AlertDialog.Root open={open} onOpenChange={setOpen}>
      <AlertDialog.Trigger
        aria-label={t('revokeLabel', { number })}
        className={buttonClassName('secondary')}
      >
        <NoSymbolIcon aria-hidden className="size-5" />
        {t('revoke')}
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="bg-scrim data-[state=open]:animate-fade-in fixed inset-0 z-30" />
        <AlertDialog.Content
          onCloseAutoFocus={(event) => {
            if (revoked.current) {
              event.preventDefault()
              focusHeading()
            }
          }}
          className="rounded-card border-border bg-surface-raised shadow-card data-[state=open]:animate-dialog-in fixed inset-x-4 top-1/2 z-40 mx-auto flex max-h-[calc(100dvh-2rem)] max-w-md -translate-y-1/2 flex-col gap-5 overflow-y-auto border p-6"
        >
          <div className="flex flex-col gap-1">
            <AlertDialog.Title className="text-xl font-semibold">
              {t('revokeTitle', { number })}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-text-muted">
              {t('revokeBody')}
            </AlertDialog.Description>
          </div>
          <ConfirmForm
            action={action}
            isDone={(state) => state.revoked === true}
            onDone={() => {
              revoked.current = true
              setOpen(false)
              announce(t('revoked'))
            }}
            confirmLabel={t('revokeConfirm')}
            pendingLabel={t('revoking')}
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
