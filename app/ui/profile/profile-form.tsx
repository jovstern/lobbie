'use client'

import { CheckCircleIcon, HandRaisedIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useRef } from 'react'
import type { ProfileFormState } from '@/app/lib/actions/users'
import { focusFirstError } from '@/app/ui/focus-first-error'
import SubmitButton from '@/app/ui/submit-button'
import TextField from '@/app/ui/text-field'

type Values = NonNullable<ProfileFormState['values']>

type Props = {
  /** `updateProfile` with the page's locale bound. */
  action: (state: ProfileFormState, formData: FormData) => Promise<ProfileFormState>
  /** The saved name and phone, as the fields show them. */
  saved: Values
  /** The sign-in address: shown, not edited. */
  email: string
  /** Just joined without a name: a short prompt asks for it, and the name field has focus. */
  askForName?: boolean
}

const fieldOrder = ['name', 'phone'] as const

/** The member's own name and phone (R13). Saving stays on the page and says so. */
export default function ProfileForm({ action, saved, email, askForName = false }: Props) {
  const t = useTranslations('ProfileForm')
  const initialState: ProfileFormState = {}
  const [state, formAction] = useActionState(action, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  // After an error, what was typed; after a save, what was saved.
  const values = state.values ?? saved

  // Focus is the DOM's, outside React: after a failed save it moves to the first error.
  useEffect(() => {
    focusFirstError(formRef.current, fieldOrder, state.errors)
  }, [state])

  return (
    <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-5">
      {askForName ? (
        <div className="rounded-control border-accent bg-surface flex items-start gap-3 border p-4">
          <HandRaisedIcon aria-hidden className="text-accent mt-0.5 size-6 shrink-0" />
          <div className="flex flex-col gap-1">
            <p className="font-semibold">{t('welcomeTitle')}</p>
            <p className="text-text-muted text-sm">{t('welcomeLead')}</p>
          </div>
        </div>
      ) : null}
      <TextField
        name="name"
        label={t('name')}
        // Typing the name is the one thing left to do after joining.
        autoFocus={askForName}
        defaultValue={values.name}
        errors={state.errors?.name}
        required
        minLength={2}
        maxLength={60}
        autoComplete="name"
      />
      <TextField
        name="phone"
        label={t('phone')}
        hint={t('phoneHint')}
        defaultValue={values.phone}
        errors={state.errors?.phone}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        // Numbers read left to right, also on the Hebrew page.
        dir="ltr"
        maxLength={20}
      />
      <dl className="flex flex-col gap-1">
        <dt className="text-sm font-medium">{t('email')}</dt>
        <dd className="font-medium">
          <bdi dir="ltr" className="break-all">
            {email}
          </bdi>
        </dd>
        <dd className="text-text-muted text-sm">{t('emailHint')}</dd>
      </dl>
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pendingLabel={t('saving')}>{t('save')}</SubmitButton>
        <div aria-live="polite" aria-atomic="true">
          {state.message ? <p className="text-danger text-sm">{state.message}</p> : null}
          {state.savedAt ? (
            // Keyed by the save, so a second save is announced again.
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
