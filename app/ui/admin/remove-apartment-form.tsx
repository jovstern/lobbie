'use client'

import { useTranslations } from 'next-intl'
import { useActionState, type ReactNode } from 'react'
import type { RemoveApartmentState } from '@/app/lib/actions/apartments'
import SubmitButton from '@/app/ui/submit-button'

export type RemoveApartmentAction = (
  state: RemoveApartmentState,
  formData: FormData,
) => Promise<RemoveApartmentState>

type Props = {
  /** `remove` with the locale and the apartment's id bound. */
  action: RemoveApartmentAction
  /** Called once the apartment is gone. */
  onRemoved: () => void
  /** The dialog's cancel button, placed beside the confirming one. */
  cancel: ReactNode
}

/** The confirming half of the remove dialog; the server may still refuse, and says why. */
export default function RemoveApartmentForm({ action, onRemoved, cancel }: Props) {
  const t = useTranslations('ApartmentRemove')
  const initialState: RemoveApartmentState = {}
  const [state, formAction] = useActionState(
    async (previous: RemoveApartmentState, formData: FormData) => {
      const next = await action(previous, formData)
      if (next.removed) onRemoved()
      return next
    },
    initialState,
  )

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div aria-live="polite" aria-atomic="true">
        {state.message ? <p className="text-danger text-sm">{state.message}</p> : null}
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        {cancel}
        <SubmitButton variant="danger" pendingLabel={t('removing')}>
          {t('confirm')}
        </SubmitButton>
      </div>
    </form>
  )
}
