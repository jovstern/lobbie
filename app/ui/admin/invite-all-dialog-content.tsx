'use client'

import { useTranslations } from 'next-intl'
import { AlertDialog } from 'radix-ui'
import type { ReactNode } from 'react'
import type { CreateAllMode } from '@/app/lib/actions/invites'
import type { LazyDialogProps } from '@/app/ui/admin/lazy-dialog'
import { buttonClassName } from '@/app/ui/button-styles'
import SubmitButton from '@/app/ui/submit-button'

type Props = LazyDialogProps & {
  /** Apartments without an active invite, and with one. */
  missingCount: number
  activeCount: number
  create: (mode: CreateAllMode) => void
  isPending: boolean
  /** The last answer's error, if any. */
  message: ReactNode
}

// Stacked full width on phones, in the order they are offered; a row from small screens up.
const choices = 'flex flex-col gap-3 sm:flex-row-reverse sm:flex-wrap sm:justify-start'
const choice = 'w-full sm:w-auto'

/**
 * `InviteAll`'s question when some apartments already have an active invite: skip them or
 * replace them. Loaded on first open (`lazy-dialog`). Once the links are made the list
 * replaces this dialog, and focus goes to it.
 */
export default function InviteAllDialogContent({
  open,
  onOpenChange,
  onCloseAutoFocus,
  missingCount,
  activeCount,
  create,
  isPending,
  message,
}: Props) {
  const t = useTranslations('InviteAll')

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
              {t('dialogTitle')}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-text-muted">
              {t('dialogBody', { active: activeCount })} {t('replaceNote')}
            </AlertDialog.Description>
          </div>
          <div aria-live="polite" aria-atomic="true">
            {message}
          </div>
          {/* The recommended choice first, the destructive one outlined, Cancel last. */}
          <div className={choices}>
            {missingCount > 0 ? (
              <form action={() => create('missing')} className={choice}>
                <SubmitButton pendingLabel={t('creating')} disabled={isPending} className={choice}>
                  {t('missingOnly', { count: missingCount })}
                </SubmitButton>
              </form>
            ) : null}
            <form action={() => create('all')} className={choice}>
              <SubmitButton
                variant="danger-outline"
                pendingLabel={t('creating')}
                disabled={isPending}
                className={choice}
              >
                {t('replaceAll', { count: activeCount })}
              </SubmitButton>
            </form>
            <AlertDialog.Cancel
              type="button"
              className={`${buttonClassName('secondary')} ${choice}`}
            >
              {t('cancel')}
            </AlertDialog.Cancel>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
