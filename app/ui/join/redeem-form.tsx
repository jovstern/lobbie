'use client'

import { useActionState } from 'react'
import type { RedeemState } from '@/app/lib/actions/invites'
import SubmitButton from '@/app/ui/submit-button'

type Props = {
  /** `redeem` with the locale and the code bound; it goes Home once joined. */
  action: () => Promise<RedeemState>
  label: string
  pendingLabel: string
}

/** "Join apartment 7": the invite may have changed since the page loaded, and then says why. */
export default function RedeemForm({ action, label, pendingLabel }: Props) {
  const initialState: RedeemState = {}
  const [state, formAction] = useActionState(action, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div aria-live="polite" aria-atomic="true">
        {state.message ? <p className="text-danger text-sm">{state.message}</p> : null}
      </div>
      <SubmitButton pendingLabel={pendingLabel}>{label}</SubmitButton>
    </form>
  )
}
