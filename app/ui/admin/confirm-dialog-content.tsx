'use client'

import { AlertDialog } from 'radix-ui'
import type { ReactNode } from 'react'
import ConfirmForm from '@/app/ui/admin/confirm-form'
import type { LazyDialogProps } from '@/app/ui/admin/lazy-dialog'
import { buttonClassName } from '@/app/ui/button-styles'

/** A confirmation's answer: a refusal's message, or done (the dialog then closes). */
export type ConfirmOutcome = { message?: string | null; done: boolean }

type Props = LazyDialogProps & {
  title: string
  description: ReactNode
  /** The description's look: a warning is set apart from the usual muted text. */
  descriptionClassName?: string
  /** The destructive action, adapted to an outcome. */
  confirm: () => Promise<ConfirmOutcome>
  onDone: () => void
  confirmLabel: string
  pendingLabel: string
  cancelLabel: string
  /** Danger by default; the accent for a choice that can be changed again later. */
  confirmVariant?: 'primary' | 'danger'
}

/**
 * A destructive action's confirmation, loaded on first open by the dialogs that ask one
 * (`lazy-dialog`). An AlertDialog: Cancel has the focus, Escape closes it.
 */
export default function ConfirmDialogContent({
  open,
  onOpenChange,
  onCloseAutoFocus,
  title,
  description,
  descriptionClassName = 'text-text-muted',
  confirm,
  onDone,
  confirmLabel,
  pendingLabel,
  cancelLabel,
  confirmVariant,
}: Props) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="bg-scrim data-[state=open]:animate-fade-in fixed inset-0 z-30" />
        <AlertDialog.Content
          onCloseAutoFocus={onCloseAutoFocus}
          className="rounded-card border-border bg-surface-raised shadow-card data-[state=open]:animate-dialog-in fixed inset-x-4 top-1/2 z-40 mx-auto flex max-h-[calc(100dvh-2rem)] max-w-md -translate-y-1/2 flex-col gap-5 overflow-y-auto border p-6"
        >
          <div className="flex flex-col gap-1">
            <AlertDialog.Title className="text-xl font-semibold">{title}</AlertDialog.Title>
            <AlertDialog.Description className={descriptionClassName}>
              {description}
            </AlertDialog.Description>
          </div>
          {/* Unmounted on close, so a refusal's message does not greet the next opening. */}
          <ConfirmForm
            action={confirm}
            isDone={(outcome) => outcome.done}
            onDone={onDone}
            confirmLabel={confirmLabel}
            pendingLabel={pendingLabel}
            variant={confirmVariant}
            cancel={
              <AlertDialog.Cancel type="button" className={buttonClassName('secondary')}>
                {cancelLabel}
              </AlertDialog.Cancel>
            }
          />
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
