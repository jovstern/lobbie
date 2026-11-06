'use client'

import { UserMinusIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useRef } from 'react'
import type { RemoveMemberState } from '@/app/lib/actions/members'
import { useAnnouncer } from '@/app/ui/admin/admin-announcer'
import { ConfirmDialogContent, preloadConfirmDialog } from '@/app/ui/admin/confirm-dialog'
import { LazyDialogSlot, useLazyDialog } from '@/app/ui/admin/lazy-dialog'
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
        aria-label={t('removeLabel', { name })}
        className={buttonClassName('secondary')}
      >
        <UserMinusIcon aria-hidden className="size-5" />
        {t('remove')}
      </button>
      <LazyDialogSlot dialog={dialog}>
        <ConfirmDialogContent
          {...dialog.content}
          title={t('title', { name })}
          description={isSelf ? t('selfDescription') : t('description', { name })}
          confirm={async () => {
            const state = await action()
            return { message: state.message, done: state.removed === true }
          }}
          onDone={() => {
            removed.current = true
            dialog.setOpen(false)
            announce(t('removed', { name }))
          }}
          confirmLabel={t('confirm')}
          pendingLabel={t('removing')}
          cancelLabel={t('cancel')}
        />
      </LazyDialogSlot>
    </>
  )
}
