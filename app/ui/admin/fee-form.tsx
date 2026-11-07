'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useRef, type ReactNode } from 'react'
import type { FeeFormState } from '@/app/lib/actions/fees'
import type { ApartmentRef } from '@/app/lib/definitions'
import { focusFirstError } from '@/app/ui/focus-first-error'
import SubmitButton from '@/app/ui/submit-button'
import TextField, { inputClassName } from '@/app/ui/text-field'

export type FeeAction = (state: FeeFormState, formData: FormData) => Promise<FeeFormState>

export type FeeSaved = NonNullable<FeeFormState['saved']>

type Props = {
  /** `setDefault`, or `setOverride` with the locale (and the apartment, or null) bound. */
  action: FeeAction
  /** The apartments to choose from, when the form picks one; none for a fixed target. */
  choices?: ApartmentRef[]
  /** The month the field starts at, as `YYYY-MM`. */
  defaultMonth: string
  /** The earliest month the server accepts, when it is known here (`YYYY-MM`). */
  minMonth?: string
  /** Called with what was saved. */
  onSaved: (saved: FeeSaved) => void
  /** The dialog's close button, placed beside the submit button. */
  cancel: ReactNode
}

const fieldOrder = ['apartmentId', 'amount', 'effectiveFrom'] as const

/** A monthly fee and the month it starts from (R14), for the building or an apartment. */
export default function FeeForm({
  action,
  choices,
  defaultMonth,
  minMonth,
  onSaved,
  cancel,
}: Props) {
  const t = useTranslations('FeeForm')
  const initialState: FeeFormState = {}
  const [state, formAction] = useActionState(async (previous: FeeFormState, formData: FormData) => {
    const next = await action(previous, formData)
    if (next.saved) onSaved(next.saved)
    return next
  }, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  const values = state.values
  const apartmentErrors = state.errors?.apartmentId

  // Focus is the DOM's, outside React: after a failed attempt it moves to the first error.
  useEffect(() => {
    focusFirstError(formRef.current, fieldOrder, state.errors)
  }, [state])

  return (
    // The server checks every field and says how to fix it, in place of the browser.
    <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-5">
      {choices ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="apartmentId" className="text-sm font-medium">
            {t('apartment')}
          </label>
          <select
            id="apartmentId"
            name="apartmentId"
            // Keyed by what was sent, so a failed attempt shows the apartment chosen.
            key={values?.apartmentId}
            defaultValue={values?.apartmentId ?? ''}
            aria-describedby="apartmentId-error"
            aria-invalid={apartmentErrors?.length ? true : undefined}
            required
            className={inputClassName}
          >
            <option value="" disabled>
              {t('chooseApartment')}
            </option>
            {choices.map((apartment) => (
              <option key={apartment.id} value={apartment.id}>
                {t('apartmentNumber', { number: apartment.number })}
              </option>
            ))}
          </select>
          <div id="apartmentId-error" aria-live="polite" aria-atomic="true">
            {apartmentErrors?.map((error) => (
              <p key={error} className="text-danger text-sm">
                {error}
              </p>
            ))}
          </div>
        </div>
      ) : null}
      <TextField
        name="amount"
        label={t('amount')}
        hint={t('amountHint')}
        defaultValue={values?.amount}
        errors={state.errors?.amount}
        inputMode="decimal"
        autoComplete="off"
        required
      />
      <TextField
        name="effectiveFrom"
        label={t('effectiveFrom')}
        hint={t('effectiveFromHint')}
        defaultValue={values?.effectiveFrom ?? defaultMonth}
        errors={state.errors?.effectiveFrom}
        // Browsers without a month picker show a text field; the placeholder, the pattern, the
        // hint and the server all ask for YYYY-MM.
        type="month"
        min={minMonth}
        placeholder="YYYY-MM"
        pattern="\d{4}-(0[1-9]|1[0-2])"
        required
      />
      <div aria-live="polite" aria-atomic="true">
        {state.message ? <p className="text-danger text-sm">{state.message}</p> : null}
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        {cancel}
        <SubmitButton pendingLabel={t('saving')}>{t('submit')}</SubmitButton>
      </div>
    </form>
  )
}
