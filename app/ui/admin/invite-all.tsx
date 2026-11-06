'use client'

import { CheckIcon, UserGroupIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { AlertDialog } from 'radix-ui'
import { useActionState, useEffect, useRef, useState } from 'react'
import type { CreateAllMode, CreateAllState } from '@/app/lib/actions/invites'
import { useCreatedInvites } from '@/app/ui/admin/created-invites-provider'
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
// Stacked full width on phones, in the order they are offered; a row from small screens up.
const choices = 'flex flex-col gap-3 sm:flex-row-reverse sm:flex-wrap sm:justify-start'
const choice = 'w-full sm:w-auto'

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
  const [asking, setAsking] = useState(false)
  const resultRef = useRef<HTMLHeadingElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)
  // What takes focus once the list appears or goes; read in an effect, not shown, so not state.
  const focusNext = useRef<'list' | 'opener' | null>(null)
  const initialState: CreateAllState = {}
  const [state, dispatch, isPending] = useActionState(
    async (_previous: CreateAllState, mode: CreateAllMode) => {
      const next = await (mode === 'all' ? allAction : missingAction)()
      if (next.created) {
        setAsking(false)
        focusNext.current = 'list'
        show({ created: next.created, skipped: next.skipped ?? 0 })
      }
      return next
    },
    initialState,
  )
  const created = list?.created ?? []
  const missingCount = apartmentCount - activeCount
  const message = state.message ? <p className="text-danger text-sm">{state.message}</p> : null
  const copyAllText = created
    // Isolated, so a link keeps its order when pasted into a right-to-left line.
    .map((invite) => t('line', { number: invite.apartmentNumber, link: `⁨${invite.link}⁩` }))
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
            <h3 ref={resultRef} tabIndex={-1} className="font-semibold">
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
            <AlertDialog.Root open={asking} onOpenChange={setAsking}>
              <AlertDialog.Trigger ref={openerRef} className={buttonClassName('primary')}>
                {openButton}
              </AlertDialog.Trigger>
              <AlertDialog.Portal>
                <AlertDialog.Overlay className="bg-scrim data-[state=open]:animate-fade-in fixed inset-0 z-30" />
                {/* Once the links are made the list replaces this dialog, and focus goes to it. */}
                <AlertDialog.Content className="rounded-card border-border bg-surface-raised shadow-card data-[state=open]:animate-dialog-in fixed inset-x-4 top-1/2 z-40 mx-auto flex max-h-[calc(100dvh-2rem)] max-w-md -translate-y-1/2 flex-col gap-5 overflow-y-auto border p-6">
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
                      <form action={() => dispatch('missing')} className={choice}>
                        <SubmitButton
                          pendingLabel={t('creating')}
                          disabled={isPending}
                          className={choice}
                        >
                          {t('missingOnly', { count: missingCount })}
                        </SubmitButton>
                      </form>
                    ) : null}
                    <form action={() => dispatch('all')} className={choice}>
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
          )}
        </div>
      )}
      <div aria-live="polite" aria-atomic="true">
        {asking ? null : message}
      </div>
    </section>
  )
}
