'use client'

import { PencilSquareIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useAnnouncer } from '@/app/ui/admin/admin-announcer'
import { LazyDialogSlot, lazyWithRetry, useLazyDialog } from '@/app/ui/admin/lazy-dialog'
import type { RoleAction, RoleValues } from '@/app/ui/admin/person-role-form'
import { buttonClassName } from '@/app/ui/button-styles'

const PersonRoleDialogContent = lazyWithRetry(
  () => import('@/app/ui/admin/person-role-dialog-content'),
)

function preload() {
  void import('@/app/ui/admin/person-role-dialog-content')
}

type Props = {
  /** `setRole` with the locale and the person's id bound. */
  action: RoleAction
  name: string
  /** Whether this is the signed-in admin, who is warned before demoting themselves. */
  isSelf: boolean
  saved: RoleValues
}

/**
 * A person's "Change role" and its dialog: the role and the committee title together. The
 * content loads on first open (`lazy-dialog`); focus moves into it, and back to the button on
 * close.
 */
export default function PersonRoleDialog({ action, name, isSelf, saved }: Props) {
  const t = useTranslations('PersonRole')
  const { announce } = useAnnouncer()
  const dialog = useLazyDialog({ preload })

  return (
    <>
      <button
        {...dialog.trigger}
        className={buttonClassName('secondary')}
        aria-label={t('editLabel', { name })}
      >
        <PencilSquareIcon aria-hidden className="size-5" />
        {t('edit')}
      </button>
      <LazyDialogSlot dialog={dialog}>
        <PersonRoleDialogContent
          {...dialog.content}
          action={action}
          name={name}
          isSelf={isSelf}
          saved={saved}
          onSaved={() => {
            dialog.setOpen(false)
            announce(t('saved', { name }))
          }}
        />
      </LazyDialogSlot>
    </>
  )
}
