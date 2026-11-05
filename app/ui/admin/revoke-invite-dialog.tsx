'use client'

import { NoSymbolIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { AlertDialog } from 'radix-ui'
import { useActionState, useRef, useState } from 'react'
import type { RevokeInviteState } from '@/app/lib/actions/invites'
import { useAnnouncer } from '@/app/ui/admin/apartments-announcer'
import { buttonClassName } from '@/app/ui/button-styles'
import SubmitButton from '@/app/ui/submit-button'

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
  const t = useTranslations('InviteAdmin')
  const { announce, focusHeading } = useAnnouncer()
  const [open, setOpen] = useState(false)
  // Read when the dialog closes, to choose where focus goes; not shown, so not state.
  const revoked = useRef(false)
  const initialState: RevokeInviteState = {}
  const [state, formAction] = useActionState(async () => {
    const next = await action()
    if (next.revoked) {
      revoked.current = true
      setOpen(false)
      announce(t('revoked'))
    }
    return next
  }, initialState)

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
          <form action={formAction} className="flex flex-col gap-5">
            <div aria-live="polite" aria-atomic="true">
              {state.message ? <p className="text-danger text-sm">{state.message}</p> : null}
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <AlertDialog.Cancel type="button" className={buttonClassName('secondary')}>
                {t('cancel')}
              </AlertDialog.Cancel>
              <SubmitButton variant="danger" pendingLabel={t('revoking')}>
                {t('revokeConfirm')}
              </SubmitButton>
            </div>
          </form>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
