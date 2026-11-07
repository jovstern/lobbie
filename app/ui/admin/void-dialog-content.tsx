'use client'

import { useLocale, useTranslations } from 'next-intl'
import { AlertDialog } from 'radix-ui'
import { useActionState, useEffect, useRef } from 'react'
import { formatMonth } from '@/app/lib/utils/dates'
import { formatAgorot } from '@/app/lib/utils/money'
import type { LazyDialogProps } from '@/app/ui/admin/lazy-dialog'
import { buttonClassName } from '@/app/ui/button-styles'
import { focusFirstError } from '@/app/ui/focus-first-error'
import SubmitButton from '@/app/ui/submit-button'
import TextField from '@/app/ui/text-field'

/**
 * What a void answers (`VoidPaymentState`, `VoidExpenseState`): what was typed and why it was
 * refused, or neither once it is done.
 */
export type VoidState = {
  values?: { reason: string }
  errors?: { reason?: string[] }
  message?: string | null
}

/** A void action with the locale and the row bound. */
export type VoidAction = (state: VoidState, formData: FormData) => Promise<VoidState>

/** What is voided, to name it: a payment, or an expense. */
export type VoidSubject =
  | { kind: 'payment'; month: string; amountAgorot: number }
  | { kind: 'expense'; description: string; amountAgorot: number; hasReceipt: boolean }

/** The words of a void's form, in the record's own terms. */
type VoidLabels = {
  reason: string
  reasonHint: string
  confirm: string
  pending: string
  cancel: string
}

type Props = LazyDialogProps & {
  action: VoidAction
  subject: VoidSubject
  /** With what was voided, in words. */
  onVoided: (message: string) => void
}

/**
 * A void's words, read here rather than sent with each row's button: a list of payments or
 * expenses would otherwise carry every row's dialog copy in the page.
 */
function useVoidCopy(subject: VoidSubject) {
  const tPayment = useTranslations('VoidPayment')
  const tExpense = useTranslations('VoidExpense')
  const locale = useLocale()
  const amount = formatAgorot(subject.amountAgorot, locale)
  if (subject.kind === 'payment') {
    const words = { month: formatMonth(subject.month, locale), amount }
    return {
      title: tPayment('title', words),
      description: tPayment('body', words),
      done: tPayment('done', words),
      labels: {
        reason: tPayment('reason'),
        reasonHint: tPayment('reasonHint'),
        confirm: tPayment('confirm'),
        pending: tPayment('pending'),
        cancel: tPayment('cancel'),
      },
    }
  }
  const words = { description: subject.description, amount }
  return {
    title: tExpense('title', words),
    // The receipt stays listed only when there is one.
    description: tExpense(subject.hasReceipt ? 'body' : 'bodyNoReceipt', words),
    done: tExpense('done', words),
    labels: {
      reason: tExpense('reason'),
      reasonHint: tExpense('reasonHint'),
      confirm: tExpense('confirm'),
      pending: tExpense('pending'),
      cancel: tExpense('cancel'),
    },
  }
}

/** The reason, then the voiding itself: the server may still refuse, and says why. */
function VoidForm({
  action,
  labels,
  onVoided,
}: {
  action: VoidAction
  labels: VoidLabels
  onVoided: () => void
}) {
  const initialState: VoidState = {}
  const [state, formAction] = useActionState(async (previous: VoidState, formData: FormData) => {
    const next = await action(previous, formData)
    // Neither an error nor a refusal: it is voided.
    if (!next.errors && !next.message) onVoided()
    return next
  }, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  // Focus is the DOM's, outside React: after a failed attempt it moves back to the reason.
  useEffect(() => {
    focusFirstError(formRef.current, ['reason'], state.errors)
  }, [state])

  return (
    // The server checks the reason and says how to fix it, in place of the browser.
    <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-5">
      <TextField
        name="reason"
        label={labels.reason}
        hint={labels.reasonHint}
        defaultValue={state.values?.reason}
        errors={state.errors?.reason}
        minLength={3}
        maxLength={200}
        autoComplete="off"
        required
      />
      <div aria-live="polite" aria-atomic="true">
        {state.message ? <p className="text-danger text-sm">{state.message}</p> : null}
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <AlertDialog.Cancel type="button" className={buttonClassName('secondary')}>
          {labels.cancel}
        </AlertDialog.Cancel>
        <SubmitButton variant="danger" pendingLabel={labels.pending}>
          {labels.confirm}
        </SubmitButton>
      </div>
    </form>
  )
}

/**
 * The confirmation of `VoidPaymentDialog` and `VoidExpenseDialog`, loaded on first open
 * (`lazy-dialog`). An AlertDialog, as
 * every destructive action's is, with the reason the void needs: focus starts in it, and
 * Escape or "Keep it" closes the dialog. The form unmounts on close, so a refusal does not
 * greet the next opening.
 */
export default function VoidDialogContent({
  open,
  onOpenChange,
  onCloseAutoFocus,
  action,
  subject,
  onVoided,
}: Props) {
  const contentRef = useRef<HTMLDivElement>(null)
  const { title, description, done, labels } = useVoidCopy(subject)

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="bg-scrim data-[state=open]:animate-fade-in fixed inset-0 z-30" />
        <AlertDialog.Content
          ref={contentRef}
          // The reason, which the void cannot go without; Cancel is one Tab away.
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            contentRef.current?.querySelector<HTMLElement>('input')?.focus()
          }}
          onCloseAutoFocus={onCloseAutoFocus}
          className="rounded-card border-border bg-surface-raised shadow-card data-[state=open]:animate-dialog-in fixed inset-x-4 top-1/2 z-40 mx-auto flex max-h-[calc(100dvh-2rem)] max-w-md -translate-y-1/2 flex-col gap-5 overflow-y-auto border p-6"
        >
          <div className="flex flex-col gap-1">
            <AlertDialog.Title className="text-xl font-semibold">{title}</AlertDialog.Title>
            <AlertDialog.Description className="text-text-muted">
              {description}
            </AlertDialog.Description>
          </div>
          <VoidForm action={action} labels={labels} onVoided={() => onVoided(done)} />
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
