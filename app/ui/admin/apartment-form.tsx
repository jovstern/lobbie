'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useActionState, useEffect, useRef, type ReactNode } from 'react'
import type { ApartmentFormState } from '@/app/lib/actions/apartments'
import { formatMonth } from '@/app/lib/utils/dates'
import BillingChangeWarning from '@/app/ui/admin/billing-change-warning'
import { focusFirstError } from '@/app/ui/focus-first-error'
import SubmitButton from '@/app/ui/submit-button'
import TextField from '@/app/ui/text-field'

export type ApartmentAction = (
  state: ApartmentFormState,
  formData: FormData,
) => Promise<ApartmentFormState>

export type ApartmentValues = NonNullable<ApartmentFormState['values']>

type Props = {
  /** `create`, or `update` with no confirmation of a new billing start, the locale bound. */
  action: ApartmentAction
  /** `update` with the confirmation bound: what "Save anyway" sends. Editing only. */
  confirmedAction?: ApartmentAction
  /** The saved apartment, as the fields show it; none when adding. */
  saved?: ApartmentValues
  /** Called with the number it was saved under. */
  onSaved: (number: string) => void
  /** The dialog's close button, placed beside the submit button. */
  cancel: ReactNode
}

type Submission = { formData: FormData; confirmed: boolean }

const fieldOrder = ['number', 'floor', 'billingStartMonth'] as const

/** An apartment's number, floor and billing start (R8), to add or to edit. */
export default function ApartmentForm({ action, confirmedAction, saved, onSaved, cancel }: Props) {
  const t = useTranslations('ApartmentForm')
  const locale = useLocale()
  const editing = saved !== undefined
  const initialState: ApartmentFormState = {}
  // One state for both submit buttons; each says which bound action it sends.
  const [state, dispatch] = useActionState(
    async (previous: ApartmentFormState, { formData, confirmed }: Submission) => {
      const next = await (confirmed && confirmedAction ? confirmedAction : action)(
        previous,
        formData,
      )
      if (next.saved) onSaved(next.saved.number)
      return next
    },
    initialState,
  )
  const formRef = useRef<HTMLFormElement>(null)
  const warningRef = useRef<HTMLDivElement>(null)
  // After an error or a question, what was typed; otherwise what is saved.
  const values = state.values ?? saved
  const change = state.confirmBillingChange
  const inMonth = (month: string | null) =>
    month ? t('inMonth', { month: formatMonth(month, locale) }) : t('inBuildingMonth')

  // Focus is the DOM's, outside React: after a failed save it moves to the first error, and
  // when the billing start needs confirming, to the warning that explains it.
  useEffect(() => {
    if (state.confirmBillingChange) warningRef.current?.focus()
    else focusFirstError(formRef.current, fieldOrder, state.errors)
  }, [state])

  return (
    <form
      ref={formRef}
      // The server checks every field and says how to fix it, in place of the browser.
      noValidate
      action={(formData) => dispatch({ formData, confirmed: false })}
      className="flex flex-col gap-5"
    >
      <TextField
        name="number"
        label={t('number')}
        hint={t('numberHint')}
        defaultValue={values?.number}
        errors={state.errors?.number}
        maxLength={10}
        autoComplete="off"
        required
      />
      <TextField
        name="floor"
        label={t('floor')}
        hint={t('floorHint')}
        defaultValue={values?.floor}
        errors={state.errors?.floor}
        type="number"
        min={-5}
        max={200}
        step={1}
        required
      />
      <TextField
        name="billingStartMonth"
        label={t('billingStartMonth')}
        hint={t('billingStartHint')}
        defaultValue={values?.billingStartMonth}
        errors={state.errors?.billingStartMonth}
        // Browsers without a month picker show a text field; the placeholder, the pattern, the
        // hint and the server all ask for YYYY-MM. Empty is the building's month.
        type="month"
        placeholder="YYYY-MM"
        pattern="\d{4}-(0[1-9]|1[0-2])"
      />
      {change ? (
        <BillingChangeWarning
          ref={warningRef}
          title={t('confirmTitle')}
          body={t('confirmBody', { from: inMonth(change.from), to: inMonth(change.to) })}
          onConfirm={(formData) => dispatch({ formData, confirmed: true })}
          label={t('saveAnyway')}
        />
      ) : null}
      <div aria-live="polite" aria-atomic="true">
        {state.message ? <p className="text-danger text-sm">{state.message}</p> : null}
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        {cancel}
        <SubmitButton pendingLabel={editing ? t('saving') : t('adding')}>
          {editing ? t('save') : t('add')}
        </SubmitButton>
      </div>
    </form>
  )
}
