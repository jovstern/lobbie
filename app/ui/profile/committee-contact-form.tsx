'use client'

import { CheckCircleIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useRef } from 'react'
import type { CommitteeContactState } from '@/app/lib/actions/users'
import { focusFirstError } from '@/app/ui/focus-first-error'
import SubmitButton from '@/app/ui/submit-button'
import TextField from '@/app/ui/text-field'

type Values = NonNullable<CommitteeContactState['values']>

type Props = {
  /** `updateCommitteeContact` with the page's locale bound. */
  action: (state: CommitteeContactState, formData: FormData) => Promise<CommitteeContactState>
  /** The published contact, as the fields show it. */
  saved: Values
}

const fieldOrder = ['committeePhone', 'committeeEmail'] as const

/** The contact a committee member publishes on the Committee page (R12). */
export default function CommitteeContactForm({ action, saved }: Props) {
  const t = useTranslations('CommitteeContactForm')
  const initialState: CommitteeContactState = {}
  const [state, formAction] = useActionState(action, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  const values = state.values ?? saved

  // Focus is the DOM's, outside React: after a failed save it moves to the first error.
  useEffect(() => {
    focusFirstError(formRef.current, fieldOrder, state.errors)
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5">
      <p className="text-text-muted text-sm">{t('hint')}</p>
      <TextField
        name="committeePhone"
        label={t('phone')}
        defaultValue={values.committeePhone}
        errors={state.errors?.committeePhone}
        type="tel"
        inputMode="tel"
        autoComplete="off"
        dir="ltr"
        maxLength={20}
      />
      <TextField
        name="committeeEmail"
        label={t('email')}
        defaultValue={values.committeeEmail}
        errors={state.errors?.committeeEmail}
        type="email"
        autoComplete="off"
        dir="ltr"
        maxLength={254}
      />
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pendingLabel={t('saving')}>{t('save')}</SubmitButton>
        <div aria-live="polite" aria-atomic="true">
          {state.message ? <p className="text-danger text-sm">{state.message}</p> : null}
          {state.savedAt ? (
            <p key={state.savedAt} className="text-success flex items-center gap-2 font-medium">
              <CheckCircleIcon aria-hidden className="size-5" />
              {t('saved')}
            </p>
          ) : null}
        </div>
      </div>
    </form>
  )
}
