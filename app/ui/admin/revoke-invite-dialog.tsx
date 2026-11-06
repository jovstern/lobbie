'use client'

import { NoSymbolIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useRef } from 'react'
import type { RevokeInviteState } from '@/app/lib/actions/invites'
import { useAnnouncer } from '@/app/ui/admin/admin-announcer'
import { ConfirmDialogContent, preloadConfirmDialog } from '@/app/ui/admin/confirm-dialog'
import { LazyDialogSlot, useLazyDialog } from '@/app/ui/admin/lazy-dialog'
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
  // Read when the dialog closes, to choose where focus goes; not shown, so not state.
  const revoked = useRef(false)
  const dialog = useLazyDialog({
    preload: preloadConfirmDialog,
    moveFocusOnClose: () => {
      if (revoked.current) focusHeading()
      return revoked.current
    },
  })

  return (
    <>
      <button
        {...dialog.trigger}
        aria-label={t('revokeLabel', { number })}
        className={buttonClassName('secondary')}
      >
        <NoSymbolIcon aria-hidden className="size-5" />
        {t('revoke')}
      </button>
      <LazyDialogSlot dialog={dialog}>
        <ConfirmDialogContent
          {...dialog.content}
          title={t('revokeTitle', { number })}
          description={t('revokeBody')}
          confirm={async () => {
            const state = await action()
            return { message: state.message, done: state.revoked === true }
          }}
          onDone={() => {
            revoked.current = true
            dialog.setOpen(false)
            announce(t('revoked'))
          }}
          confirmLabel={t('revokeConfirm')}
          pendingLabel={t('revoking')}
          // Not "Cancel": in Hebrew both buttons would start with ביטול ("revoke" too).
          cancelLabel={t('revokeCancel')}
        />
      </LazyDialogSlot>
    </>
  )
}
