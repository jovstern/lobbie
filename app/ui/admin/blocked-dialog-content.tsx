'use client'

import { Dialog } from 'radix-ui'
import type { LazyDialogProps } from '@/app/ui/admin/lazy-dialog'
import { buttonClassName } from '@/app/ui/button-styles'

type Props = LazyDialogProps & { title: string; reason: string; closeLabel: string }

/**
 * Why an action cannot be done yet and what to do first, loaded on first open
 * (`lazy-dialog`). Its one button closes it.
 */
export default function BlockedDialogContent({
  open,
  onOpenChange,
  onCloseAutoFocus,
  title,
  reason,
  closeLabel,
}: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-scrim data-[state=open]:animate-fade-in fixed inset-0 z-30" />
        <Dialog.Content
          onCloseAutoFocus={onCloseAutoFocus}
          className="rounded-card border-border bg-surface-raised shadow-card data-[state=open]:animate-dialog-in fixed inset-x-4 top-1/2 z-40 mx-auto flex max-h-[calc(100dvh-2rem)] max-w-md -translate-y-1/2 flex-col gap-5 overflow-y-auto border p-6"
        >
          <div className="flex flex-col gap-1">
            <Dialog.Title className="text-xl font-semibold">{title}</Dialog.Title>
            <Dialog.Description className="text-text-muted">{reason}</Dialog.Description>
          </div>
          <div className="flex justify-end">
            <Dialog.Close className={buttonClassName('primary')}>{closeLabel}</Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
