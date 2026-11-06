'use client'

import { useTranslations } from 'next-intl'
import { AlertDialog } from 'radix-ui'
import type { ReactNode } from 'react'
import type { LazyDialogProps } from '@/app/ui/admin/lazy-dialog'
import { buttonClassName } from '@/app/ui/button-styles'
import SubmitButton from '@/app/ui/submit-button'

type Props = LazyDialogProps & {
  number: string
  /** Creates the new invite, replacing the active one. */
  replace: () => void
  /** The last answer's error, if any. */
  message: ReactNode
}

/** `InviteControls`' "Create new invite" confirmation, loaded on first open (`lazy-dialog`). */
export default function ReplaceInviteDialogContent({
  open,
  onOpenChange,
  onCloseAutoFocus,
  number,
  replace,
  message,
}: Props) {
  const t = useTranslations('InviteAdminClient')

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="bg-scrim data-[state=open]:animate-fade-in fixed inset-0 z-30" />
        <AlertDialog.Content
          onCloseAutoFocus={onCloseAutoFocus}
          className="rounded-card border-border bg-surface-raised shadow-card data-[state=open]:animate-dialog-in fixed inset-x-4 top-1/2 z-40 mx-auto flex max-h-[calc(100dvh-2rem)] max-w-md -translate-y-1/2 flex-col gap-5 overflow-y-auto border p-6"
        >
          <div className="flex flex-col gap-1">
            <AlertDialog.Title className="text-xl font-semibold">
              {t('replaceTitle', { number })}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-text-muted">
              {t('replaceBody')}
            </AlertDialog.Description>
          </div>
          <form action={replace} className="flex flex-col gap-5">
            <div aria-live="polite" aria-atomic="true">
              {message}
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <AlertDialog.Cancel type="button" className={buttonClassName('secondary')}>
                {t('cancel')}
              </AlertDialog.Cancel>
              <SubmitButton variant="danger" pendingLabel={t('creating')}>
                {t('replaceConfirm')}
              </SubmitButton>
            </div>
          </form>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
