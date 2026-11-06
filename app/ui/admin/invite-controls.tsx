'use client'

import { ArrowPathIcon, PlusIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { AlertDialog } from 'radix-ui'
import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react'
import type { CreateInviteState } from '@/app/lib/actions/invites'
import { useAnnouncer } from '@/app/ui/admin/admin-announcer'
import CreatedInvite from '@/app/ui/admin/created-invite'
import { buttonClassName } from '@/app/ui/button-styles'
import SubmitButton from '@/app/ui/submit-button'

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
  const [confirming, setConfirming] = useState(false)
  const createdRef = useRef<HTMLDivElement>(null)
  // Read when the confirmation closes, to leave focus on the new link; not shown, so not state.
  const justCreated = useRef(false)
  const initialState: CreateInviteState = {}
  const [state, dispatch] = useActionState(
    async (_previous: CreateInviteState, replace: boolean) => {
      const next = await (replace ? replaceAction : createAction)()
      if (next.created) {
        justCreated.current = true
        setConfirming(false)
        announce(t('created'))
      }
      return next
    },
    initialState,
  )
  const created = state.created?.inviteId === activeInviteId ? state.created : undefined
  const message = state.message ? <p className="text-danger text-sm">{state.message}</p> : null

  // Focus is the DOM's, outside React: the button that created the invite may be gone, and the
  // new link is what the admin came for.
  // It moves once the new link is shown, which is once the page knows it as the active invite.
  const shownId = created?.inviteId
  useEffect(() => {
    if (shownId) createdRef.current?.focus()
  }, [shownId])

  return (
    <div className="flex flex-col gap-4">
      {created ? <CreatedInvite ref={createdRef} invite={created} /> : null}
      {/* While the confirmation is open, its own region says it instead. */}
      <div aria-live="polite" aria-atomic="true">
        {confirming ? null : message}
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
          <AlertDialog.Root
            open={confirming}
            onOpenChange={(open) => {
              setConfirming(open)
              if (open) justCreated.current = false
            }}
          >
            <AlertDialog.Trigger className={buttonClassName('secondary')}>
              <ArrowPathIcon aria-hidden className="size-5" />
              {t('replace')}
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Overlay className="bg-scrim data-[state=open]:animate-fade-in fixed inset-0 z-30" />
              <AlertDialog.Content
                onCloseAutoFocus={(event) => {
                  // The new link has the focus already.
                  if (justCreated.current) event.preventDefault()
                }}
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
                <form action={() => dispatch(true)} className="flex flex-col gap-5">
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
        )}
        {revoke}
      </div>
    </div>
  )
}
