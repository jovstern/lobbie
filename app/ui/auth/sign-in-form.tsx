'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useRef } from 'react'
import type { SignInState } from '@/app/lib/actions/auth'
import SubmitButton from '@/app/ui/submit-button'

type Props = {
  /** `requestMagicLink` with the page's locale and `next` bound. */
  action: (state: SignInState, formData: FormData) => Promise<SignInState>
  /** Focus the field on arrival: only where typing is the one thing left to do. */
  autoFocus?: boolean
}

export default function SignInForm({ action, autoFocus = false }: Props) {
  const t = useTranslations('SignInForm')
  const initialState: SignInState = {}
  const [state, formAction] = useActionState(action, initialState)
  const inputRef = useRef<HTMLInputElement>(null)
  const fieldErrors = state.errors?.email
  const message =
    state.retryAfterSeconds !== undefined
      ? t('rateLimited', { minutes: Math.ceil(state.retryAfterSeconds / 60) })
      : state.message
  const hasError = Boolean(fieldErrors?.length || message)

  // Focus is the DOM's, outside React: after each failed attempt it returns to the field.
  useEffect(() => {
    if (hasError) inputRef.current?.focus()
  }, [state, hasError])

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-medium">
          {t('emailLabel')}
        </label>
        <input
          ref={inputRef}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus={autoFocus}
          // Addresses are written left to right, also on the Hebrew page.
          dir="ltr"
          defaultValue={state.email}
          aria-describedby="email-error"
          aria-invalid={fieldErrors !== undefined}
          className="rounded-control border-text-muted bg-surface text-text hover:border-text focus-visible:border-accent aria-invalid:border-danger min-h-11 border px-3 text-base transition-[background-color,border-color,color]"
        />
        <div id="email-error" aria-live="polite" aria-atomic="true">
          {fieldErrors?.map((error) => (
            <p key={error} className="text-danger text-sm">
              {error}
            </p>
          ))}
          {message ? <p className="text-danger text-sm">{message}</p> : null}
        </div>
      </div>
      <SubmitButton pendingLabel={t('sending')}>{t('submit')}</SubmitButton>
    </form>
  )
}
