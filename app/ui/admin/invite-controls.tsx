'use client'

import { ArrowPathIcon, PlusIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { lazy, useActionState, useRef, type ReactNode } from 'react'
import type { CreateInviteState } from '@/app/lib/actions/invites'
import { useAnnouncer } from '@/app/ui/admin/admin-announcer'
import CreatedInvite from '@/app/ui/admin/created-invite'
import { LazyDialogSlot, useLazyDialog } from '@/app/ui/admin/lazy-dialog'
import { buttonClassName } from '@/app/ui/button-styles'
import SubmitButton from '@/app/ui/submit-button'

// Appears only after a click.
const ReplaceInviteDialogContent = lazy(
  () => import('@/app/ui/admin/replace-invite-dialog-content'),
)

function preloadReplace() {
  void import('@/app/ui/admin/replace-invite-dialog-content')
}

type CreateAction = () => Promise<CreateInviteState>

type Props = {
  /** `create` with the locale, the apartment and no replacing bound. */
  createAction: CreateAction
  /** `create` with replacing bound: what the confirmation sends. */
  replaceAction: CreateAction
  number: string
  /** The apartment's invite that still works, if any. */
  activeInviteId: string | null
  /** The active invite's "Revoke", placed beside "Create new invite". */
  revoke?: ReactNode
}

/**
 * "Create invite", or "Create new invite" (which asks first, since the current link stops
 * working), and the new link right after. The link lives only in the action's answer, and is
 * shown while it is still the apartment's active invite: once revoked or replaced, it goes.
 */
export default function InviteControls({
  createAction,
  replaceAction,
  number,
  activeInviteId,
  revoke,
}: Props) {
  const t = useTranslations('InviteAdminClient')
  const { announce } = useAnnouncer()
  // Read when the confirmation closes, to leave focus on the new link; not shown, so not state.
  const justCreated = useRef(false)
  const confirmation = useLazyDialog({
    preload: preloadReplace,
    onOpen: () => {
      justCreated.current = false
    },
    // The new link has the focus already.
    moveFocusOnClose: () => justCreated.current,
  })
  const initialState: CreateInviteState = {}
  const [state, dispatch] = useActionState(
    async (_previous: CreateInviteState, replace: boolean) => {
      const next = await (replace ? replaceAction : createAction)()
      if (next.created) {
        justCreated.current = true
        confirmation.setOpen(false)
        announce(t('created'))
      }
      return next
    },
    initialState,
  )
  const created = state.created?.inviteId === activeInviteId ? state.created : undefined
  const message = state.message ? <p className="text-danger text-sm">{state.message}</p> : null

  return (
    <div className="flex flex-col gap-4">
      {/* It takes the focus as it appears: the new link is what the admin came for. */}
      {created ? <CreatedInvite key={created.inviteId} invite={created} /> : null}
      {/* While the confirmation is open, its own region says it instead. */}
      <div aria-live="polite" aria-atomic="true">
        {confirmation.open ? null : message}
      </div>
      <div className="flex flex-wrap items-start gap-3">
        {activeInviteId === null ? (
          <form action={() => dispatch(false)}>
            <SubmitButton pendingLabel={t('creating')}>
              <PlusIcon aria-hidden className="size-5" />
              {t('create')}
            </SubmitButton>
          </form>
        ) : (
          <>
            <button {...confirmation.trigger} className={buttonClassName('secondary')}>
              <ArrowPathIcon aria-hidden className="size-5" />
              {t('replace')}
            </button>
            <LazyDialogSlot mounted={confirmation.mounted}>
              <ReplaceInviteDialogContent
                {...confirmation.content}
                number={number}
                replace={() => dispatch(true)}
                message={message}
              />
            </LazyDialogSlot>
          </>
        )}
        {revoke}
      </div>
    </div>
  )
}
