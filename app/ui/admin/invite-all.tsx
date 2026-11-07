'use client'

import { CheckIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useRef } from 'react'
import type { CreateAllMode, CreateAllState } from '@/app/lib/actions/invites'
import { useCreatedInvites } from '@/app/ui/admin/created-invites-provider'
import { LazyDialogSlot, lazyWithRetry, useLazyDialog } from '@/app/ui/admin/lazy-dialog'
import { buttonClassName } from '@/app/ui/button-styles'
import CopyButton from '@/app/ui/copy-button'
import { cardClassName } from '@/app/ui/card'
import SubmitButton from '@/app/ui/submit-button'

type Props = {
  /** `createAll` with the locale and `missing` bound. */
  missingAction: () => Promise<CreateAllState>
  /** `createAll` with the locale and `all` bound: replaces the active invites too. */
  allAction: () => Promise<CreateAllState>
  apartmentCount: number
  /** Apartments that already have an active invite. */
  activeCount: number
}

const InviteAllDialogContent = lazyWithRetry(
  () => import('@/app/ui/admin/invite-all-dialog-content'),
)

function preload() {
  void import('@/app/ui/admin/invite-all-dialog-content')
}

const listId = 'new-invite-links'

/**
 * "Invite every apartment" and the copyable list it gives (R9), the fastest way to invite a
 * building. With no active invites it creates at once; otherwise it asks whether to skip or
 * replace them. The list stays until the admin says they copied it (see
 * `CreatedInvitesProvider`); meanwhile the button gives way to it.
 */
export default function InviteAll({
  missingAction,
  allAction,
  apartmentCount,
  activeCount,
}: Props) {
  const t = useTranslations('InviteAll')
  const { list, show, dismiss } = useCreatedInvites()
  const resultRef = useRef<HTMLHeadingElement>(null)
  // What takes focus once the list appears or goes; read in an effect, not shown, so not state.
  const focusNext = useRef<'list' | 'opener' | null>(null)
  // Once the links are made the list replaces the dialog's button, and focus goes to the list.
  const openerRef = useRef<HTMLButtonElement>(null)
  const dialog = useLazyDialog({
    preload,
    triggerRef: openerRef,
    moveFocusOnClose: () => focusNext.current === 'list',
  })
  const initialState: CreateAllState = {}
  const [state, dispatch, isPending] = useActionState(
    async (_previous: CreateAllState, mode: CreateAllMode): Promise<CreateAllState> => {
      const next = await (mode === 'all' ? allAction : missingAction)()
      if (next.created) {
        dialog.setOpen(false)
        focusNext.current = 'list'
        show({ created: next.created, skipped: next.skipped ?? 0 })
      }
      // The links live in the section's context until Done; the state keeps only the message,
      // so no plaintext code outlives the list.
      return { message: next.message }
    },
    initialState,
  )
  const created = list?.created ?? []
  const missingCount = apartmentCount - activeCount
  const message = state.message ? <p className="text-danger text-sm">{state.message}</p> : null
  const copyAllText = created
    // The apartment on one line and its link on the next, so a link never shares a line with
    // right-to-left text when pasted.
    .map((invite) => t('line', { number: invite.apartmentNumber, link: invite.link }))
    .join('\n')

  // Focus is the DOM's, outside React: the list is what the admin came for, and once they are
  // done with it, the button that replaced it.
  useEffect(() => {
    if (focusNext.current === 'list') resultRef.current?.focus()
    if (focusNext.current === 'opener') openerRef.current?.focus()
    focusNext.current = null
  }, [list])

  const openButton = (
    <>
      <UserGroupIcon aria-hidden className="size-5" />
      {t('open')}
    </>
  )

  return (
    <section aria-labelledby="invite-all-title" className={cardClassName}>
      <div className="flex flex-col gap-1">
        <h2 id="invite-all-title" className="text-lg font-semibold">
          {t('sectionTitle')}
        </h2>
        {list ? null : <p className="text-text-muted max-w-prose">{t('sectionLead')}</p>}
      </div>
      {list ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 ref={resultRef} tabIndex={-1} className="font-semibold focus:outline-none">
              {t('resultTitle', { count: created.length })}
            </h3>
            {created.length > 0 ? (
              <p className="text-text-muted max-w-prose text-sm">{t('resultLead')}</p>
            ) : null}
            {list.skipped ? (
              <p className="text-text-muted max-w-prose text-sm">
                {t('skipped', { count: list.skipped })}
              </p>
            ) : null}
          </div>
          {created.length > 0 ? (
            <>
              <CopyButton
                text={copyAllText}
                label={t('copyAll')}
                sourceId={listId}
                variant="primary"
              />
              <ol id={listId} aria-label={t('listLabel')} className="divide-border divide-y">
                {created.map((invite) => {
                  const linkId = `invite-link-${invite.apartmentId}`
                  return (
                    <li
                      key={invite.apartmentId}
                      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="font-medium">
                          {t('apartment', { number: invite.apartmentNumber })}
                        </span>
                        <span id={linkId} dir="ltr" className="text-start text-sm break-all">
                          {invite.link}
                        </span>
                      </div>
                      <CopyButton
                        text={invite.link}
                        label={t('copyLink')}
                        accessibleLabel={t('copyLinkLabel', { number: invite.apartmentNumber })}
                        sourceId={linkId}
                      />
                    </li>
                  )
                })}
              </ol>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => {
              focusNext.current = 'opener'
              dismiss()
            }}
            className={`${buttonClassName('secondary')} self-start`}
          >
            <CheckIcon aria-hidden className="size-5" />
            {created.length > 0 ? t('done') : t('close')}
          </button>
        </div>
      ) : (
        <div>
          {activeCount === 0 ? (
            <form action={() => dispatch('missing')}>
              <SubmitButton pendingLabel={t('creating')}>{openButton}</SubmitButton>
            </form>
          ) : (
            <>
              <button {...dialog.trigger} className={buttonClassName('primary')}>
                {openButton}
              </button>
              <LazyDialogSlot dialog={dialog}>
                <InviteAllDialogContent
                  {...dialog.content}
                  missingCount={missingCount}
                  activeCount={activeCount}
                  create={dispatch}
                  isPending={isPending}
                  message={message}
                />
              </LazyDialogSlot>
            </>
          )}
        </div>
      )}
      <div aria-live="polite" aria-atomic="true">
        {dialog.open ? null : message}
      </div>
    </section>
  )
}
