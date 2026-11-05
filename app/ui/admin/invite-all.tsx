'use client'

import { UserGroupIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { AlertDialog } from 'radix-ui'
import { useActionState, useEffect, useRef, useState } from 'react'
import type { CreateAllMode, CreateAllState } from '@/app/lib/actions/invites'
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

const listId = 'new-invite-links'

/**
 * "Create invites for all apartments" and the copyable list it gives (R9), the fastest way to
 * invite a building. With no active invites it creates at once; otherwise it asks whether to
 * skip or replace them. The list lives only in the action's answer: shown once, never stored.
 */
export default function InviteAll({
  missingAction,
  allAction,
  apartmentCount,
  activeCount,
}: Props) {
  const t = useTranslations('InviteAll')
  const [asking, setAsking] = useState(false)
  const resultRef = useRef<HTMLHeadingElement>(null)
  // Read when the question closes, to leave focus on the list; not shown, so not state.
  const justCreated = useRef(false)
  const initialState: CreateAllState = {}
  const [state, dispatch, isPending] = useActionState(
    async (previous: CreateAllState, mode: CreateAllMode) => {
      const next = await (mode === 'all' ? allAction : missingAction)()
      if (next.created) {
        justCreated.current = true
        setAsking(false)
      }
      // Nothing new (every apartment had an invite meanwhile) never hides links the admin
      // may not have copied yet: they are shown only this once.
      if (next.created?.length === 0 && previous.created?.length) return previous
      return next
    },
    initialState,
  )
  const created = state.created ?? []
  const missingCount = apartmentCount - activeCount
  const message = state.message ? <p className="text-danger text-sm">{state.message}</p> : null
  const copyAllText = created
    // Isolated, so a link keeps its order when pasted into a right-to-left line.
    .map((invite) =>
      t('line', { number: invite.apartmentNumber, link: `\u2068${invite.link}\u2069` }),
    )
    .join('\n')

  // Focus is the DOM's, outside React: the list is what the admin came for.
  useEffect(() => {
    if (state.created) resultRef.current?.focus()
  }, [state])

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
        <p className="text-text-muted max-w-prose">{t('sectionLead')}</p>
      </div>
      <div>
        {activeCount === 0 ? (
          <form action={() => dispatch('missing')}>
            <SubmitButton pendingLabel={t('creating')}>{openButton}</SubmitButton>
          </form>
        ) : (
          <AlertDialog.Root
            open={asking}
            onOpenChange={(open) => {
              setAsking(open)
              if (open) justCreated.current = false
            }}
          >
            <AlertDialog.Trigger className={buttonClassName('primary')}>
              {openButton}
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Overlay className="bg-scrim data-[state=open]:animate-fade-in fixed inset-0 z-30" />
              <AlertDialog.Content
                onCloseAutoFocus={(event) => {
                  if (justCreated.current) event.preventDefault()
                }}
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
                <div className="flex flex-wrap justify-end gap-3">
                  <AlertDialog.Cancel type="button" className={buttonClassName('secondary')}>
                    {t('cancel')}
                  </AlertDialog.Cancel>
                  <form action={() => dispatch('all')}>
                    <SubmitButton
                      variant="danger"
                      pendingLabel={t('creating')}
                      disabled={isPending}
                    >
                      {t('replaceAll', { count: activeCount })}
                    </SubmitButton>
                  </form>
                  {missingCount > 0 ? (
                    <form action={() => dispatch('missing')}>
                      <SubmitButton pendingLabel={t('creating')} disabled={isPending}>
                        {t('missingOnly', { count: missingCount })}
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>
              </AlertDialog.Content>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        )}
      </div>
      <div aria-live="polite" aria-atomic="true">
        {asking ? null : message}
      </div>
      {state.created ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 ref={resultRef} tabIndex={-1} className="font-semibold">
              {t('resultTitle', { count: created.length })}
            </h3>
            {created.length > 0 ? (
              <p className="text-text-muted max-w-prose text-sm">{t('resultLead')}</p>
            ) : null}
            {state.skipped ? (
              <p className="text-text-muted max-w-prose text-sm">
                {t('skipped', { count: state.skipped })}
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
        </div>
      ) : null}
    </section>
  )
}
