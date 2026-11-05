'use client'

import { PencilSquareIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { Dialog } from 'radix-ui'
import { useRef, useState } from 'react'
import { useAnnouncer } from '@/app/ui/admin/admin-announcer'
import PersonRoleForm, { type RoleAction, type RoleValues } from '@/app/ui/admin/person-role-form'
import { buttonClassName } from '@/app/ui/button-styles'

type Props = {
  /** `setRole` with the locale and the person's id bound. */
  action: RoleAction
  name: string
  /** Whether this is the signed-in admin, who is warned before demoting themselves. */
  isSelf: boolean
  saved: RoleValues
}

/**
 * A person's "Change role" and its dialog: the role and the committee title together. Radix
 * traps focus inside, closes on Escape and returns focus to the button. The form unmounts on
 * close, so each opening starts from the saved values.
 */
export default function PersonRoleDialog({ action, name, isSelf, saved }: Props) {
  const t = useTranslations('PersonRole')
  const { announce } = useAnnouncer()
  const [open, setOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className={buttonClassName('secondary')}
        aria-label={t('editLabel', { name })}
      >
        <PencilSquareIcon aria-hidden className="size-5" />
        {t('edit')}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-scrim data-[state=open]:animate-fade-in fixed inset-0 z-30" />
        <Dialog.Content
          ref={contentRef}
          // The saved role, not the close button: choosing a role is what the dialog is for.
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            contentRef.current
              ?.querySelector<HTMLInputElement>('input[name="role"]:checked')
              ?.focus()
          }}
          className="rounded-card border-border bg-surface-raised shadow-card data-[state=open]:animate-dialog-in fixed inset-x-4 top-1/2 z-40 mx-auto flex max-h-[calc(100dvh-2rem)] max-w-md -translate-y-1/2 flex-col gap-5 overflow-y-auto border p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="text-xl font-semibold">{t('title', { name })}</Dialog.Title>
              <Dialog.Description className="text-text-muted">
                {t('description')}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label={t('close')}
              className="rounded-control text-text-muted hover:bg-surface hover:text-text -me-2 -mt-2 flex size-11 shrink-0 items-center justify-center transition-[background-color,color]"
            >
              <XMarkIcon aria-hidden className="size-6" />
            </Dialog.Close>
          </div>
          <PersonRoleForm
            action={action}
            saved={saved}
            isSelf={isSelf}
            onSaved={() => {
              setOpen(false)
              announce(t('saved', { name }))
            }}
            cancel={
              <Dialog.Close type="button" className={buttonClassName('secondary')}>
                {t('cancel')}
              </Dialog.Close>
            }
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
