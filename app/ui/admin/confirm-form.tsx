'use client'

import { useActionState, type ReactNode } from 'react'
import SubmitButton from '@/app/ui/submit-button'

type Answer = { message?: string | null }

type Props<State extends Answer> = {
  /** The destructive action, with everything it needs bound. */
  action: () => Promise<State>
  /** Whether the answer means it is done (the dialog then closes). */
  isDone: (state: State) => boolean
  onDone: () => void
  confirmLabel: string
  pendingLabel: string
  /** Danger by default; the accent for a choice that can be changed again later. */
  variant?: 'primary' | 'danger'
  /** The dialog's cancel button, placed beside the confirming one. */
  cancel: ReactNode
}

/**
 * The confirming half of a destructive AlertDialog: the server may still refuse, and the
 * message says why. Mounted inside the dialog's content, so a refusal does not greet the next
 * opening.
 */
export default function ConfirmForm<State extends Answer>({
  action,
  isDone,
  onDone,
  confirmLabel,
  pendingLabel,
  variant = 'danger',
  cancel,
}: Props<State>) {
  const initialState: State | null = null
  const [state, formAction] = useActionState(async () => {
    const next = await action()
    if (isDone(next)) onDone()
    return next
  }, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div aria-live="polite" aria-atomic="true">
        {state?.message ? <p className="text-danger text-sm">{state.message}</p> : null}
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        {cancel}
        <SubmitButton variant={variant} pendingLabel={pendingLabel}>
          {confirmLabel}
        </SubmitButton>
      </div>
    </form>
  )
}
