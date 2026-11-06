'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useRef } from 'react'
import type { JoinCodeState } from '@/app/lib/actions/invites'
import { focusFirstError } from '@/app/ui/focus-first-error'
import SubmitButton from '@/app/ui/submit-button'
import TextField from '@/app/ui/text-field'

type Props = {
  /** `lookup` with the page's locale bound; a known code opens its invite page. */
  action: (state: JoinCodeState, formData: FormData) => Promise<JoinCodeState>
}

const fieldOrder = ['code'] as const

/** `/join`'s code entry, for an invite read out or typed rather than opened as a link. */
export default function JoinCodeForm({ action }: Props) {
  const t = useTranslations('JoinCodeForm')
  const initialState: JoinCodeState = {}
  const [state, formAction] = useActionState(action, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  // Focus is the DOM's, outside React: after each failed attempt it returns to the field.
  useEffect(() => {
    focusFirstError(formRef.current, fieldOrder, state.error ? { code: [state.error] } : undefined)
  }, [state])

  return (
    <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-4">
      <TextField
        name="code"
        label={t('label')}
        hint={t('hint')}
        defaultValue={state.code}
        errors={state.error ? [state.error] : undefined}
        // Codes are Latin letters and digits, written left to right also on the Hebrew page.
        dir="ltr"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        // Typing the code is the one thing this page is for.
        autoFocus
        maxLength={20}
        required
      />
      <SubmitButton pendingLabel={t('checking')}>{t('submit')}</SubmitButton>
    </form>
  )
}
