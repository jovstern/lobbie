'use client'

import { useRef, useState, type ReactNode } from 'react'
import type { ApartmentRef, OpenMonth } from '@/app/lib/definitions'
import { useMaybeAnnouncer } from '@/app/ui/admin/admin-announcer'
import { ConfirmDialogContent, preloadConfirmDialog } from '@/app/ui/admin/confirm-dialog'
import type { FeeAction } from '@/app/ui/admin/fee-form'
import { LazyDialogSlot, lazyWithRetry, useLazyDialog } from '@/app/ui/admin/lazy-dialog'
import type { PaymentAction } from '@/app/ui/admin/payment-form'
import type { VoidAction, VoidLabels } from '@/app/ui/admin/void-dialog-content'
import { buttonClassName, type ButtonVariant } from '@/app/ui/button-styles'

// One client module for the money dialogs' buttons (record a payment, set a fee, void, follow
// the building fee): each used to be its own module around the same lazy-dialog code, which a
// page with several of them paid for again and again. The button's words and icon are rendered
// on the server and passed in; only the dialog's content loads, on first open.

const PaymentDialogContent = lazyWithRetry(() => import('@/app/ui/admin/payment-dialog-content'))
const FeeDialogContent = lazyWithRetry(() => import('@/app/ui/admin/fee-dialog-content'))
const VoidDialogContent = lazyWithRetry(() => import('@/app/ui/admin/void-dialog-content'))

/** Whose fee the dialog sets: the building's, one apartment's, or one chosen in the form. */
export type FeeTarget =
  | { kind: 'building' }
  | { kind: 'apartment'; number: string }
  | { kind: 'chosen'; choices: ApartmentRef[] }

/** Which dialog the button opens, with what its content needs. */
export type MoneyDialog =
  | {
      kind: 'payment'
      action: PaymentAction
      number: string
      months: OpenMonth[]
      today: string
      firstDay: string
      lastMonth: string
    }
  | {
      kind: 'fee'
      action: FeeAction
      target: FeeTarget
      defaultMonth: string
      minMonth?: string
    }
  | {
      kind: 'void'
      action: VoidAction
      title: string
      description: string
      labels: VoidLabels
      /** What the page says once it is voided. */
      done: string
    }
  | {
      kind: 'confirm'
      action: () => Promise<{ message?: string | null; done?: boolean }>
      title: string
      description: string
      labels: { confirm: string; pending: string; cancel: string }
      /** What the page says once it is done. */
      done: string
      /** A choice that can be changed again later confirms with the accent, not danger. */
      variant?: 'primary' | 'danger'
    }

const preloads: Record<MoneyDialog['kind'], () => void> = {
  payment: () => void import('@/app/ui/admin/payment-dialog-content'),
  fee: () => void import('@/app/ui/admin/fee-dialog-content'),
  void: () => void import('@/app/ui/admin/void-dialog-content'),
  confirm: preloadConfirmDialog,
}

type Props = {
  dialog: MoneyDialog
  /** The button's icon and words, rendered by the server. */
  children: ReactNode
  /** The button's accessible name, when its words alone do not say which row it acts on. */
  label?: string
  variant?: ButtonVariant
  /**
   * Where what was done is said: beside the button, or in the status region of the nearest
   * `AdminAnnouncer` (the page's, or the apartment panel's).
   */
  status?: 'beside' | 'announcer'
  /**
   * The button leaves the page once it is done (a voided row loses its Void): focus goes to the
   * announcer's heading instead of back to it.
   */
  leaves?: boolean
}

/**
 * A money dialog's button and its dialog, whose content loads on first open (`lazy-dialog`).
 * Focus moves into the dialog, and back to the button on close, or to the announcer's heading
 * when the button is gone; what was done is announced.
 */
export default function LazyDialogButton({
  dialog,
  children,
  label,
  variant = 'secondary',
  status = 'beside',
  leaves = false,
}: Props) {
  const announcer = useMaybeAnnouncer()
  // Said beside the button, keyed by a count so the same message twice is said twice.
  const [said, setSaid] = useState<{ message: string; count: number } | null>(null)
  // Read when the dialog closes, to choose where focus goes; not shown, so not state.
  const done = useRef(false)
  const lazy = useLazyDialog({
    preload: preloads[dialog.kind],
    onOpen: () => {
      done.current = false
      setSaid(null)
    },
    moveFocusOnClose: () => {
      if (!done.current || !leaves || !announcer) return false
      announcer.focusHeading()
      return true
    },
  })

  function finish(message: string) {
    done.current = true
    lazy.setOpen(false)
    if (status === 'announcer' && announcer) announcer.announce(message)
    else setSaid((previous) => ({ message, count: (previous?.count ?? 0) + 1 }))
  }

  function content() {
    switch (dialog.kind) {
      case 'payment':
        return <PaymentDialogContent {...lazy.content} {...dialog} onRecorded={finish} />
      case 'fee':
        return <FeeDialogContent {...lazy.content} {...dialog} onSaved={finish} />
      case 'void':
        return (
          <VoidDialogContent
            {...lazy.content}
            action={dialog.action}
            title={dialog.title}
            description={dialog.description}
            labels={dialog.labels}
            onVoided={() => finish(dialog.done)}
          />
        )
      case 'confirm':
        return (
          <ConfirmDialogContent
            {...lazy.content}
            title={dialog.title}
            description={dialog.description}
            confirm={async () => {
              const state = await dialog.action()
              return { message: state.message, done: state.done === true }
            }}
            onDone={() => finish(dialog.done)}
            confirmLabel={dialog.labels.confirm}
            pendingLabel={dialog.labels.pending}
            cancelLabel={dialog.labels.cancel}
            confirmVariant={dialog.variant}
          />
        )
    }
  }

  const button = (
    <button {...lazy.trigger} aria-label={label} className={buttonClassName(variant)}>
      {children}
    </button>
  )
  const slot = <LazyDialogSlot dialog={lazy}>{content()}</LazyDialogSlot>

  if (status === 'announcer') {
    return (
      <>
        {button}
        {slot}
      </>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      {button}
      {slot}
      <div role="status" aria-live="polite" aria-atomic="true">
        {said ? (
          <p key={said.count} className="text-success font-medium">
            {said.message}
          </p>
        ) : null}
      </div>
    </div>
  )
}
