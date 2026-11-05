'use client'

import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import { useActionState, useEffect, useRef } from 'react'
import type { BuildingFormState } from '@/app/lib/actions/buildings'
import { formatMonth } from '@/app/lib/utils/dates'
import { buttonClassName } from '@/app/ui/button-styles'
import { focusFirstError } from '@/app/ui/focus-first-error'
import SubmitButton from '@/app/ui/submit-button'
import TextField from '@/app/ui/text-field'

type Values = NonNullable<BuildingFormState['values']>
type BuildingAction = (state: BuildingFormState, formData: FormData) => Promise<BuildingFormState>

type Props = {
  /** `update` with the page's locale bound, and no confirmation of a new billing month. */
  action: BuildingAction
  /** The same with the confirmation bound: what "Save anyway" sends. */
  confirmedAction: BuildingAction
  /** The saved details, as the fields show them. */
  saved: Values
}

type Submission = { formData: FormData; confirmed: boolean }

const fieldOrder = ['name', 'address', 'quorumPercent', 'billingStartMonth'] as const

/** The building's details (R7). Saving stays on the page and says so. */
export default function BuildingForm({ action, confirmedAction, saved }: Props) {
  const t = useTranslations('BuildingForm')
  const locale = useLocale()
  const initialState: BuildingFormState = {}
  // One state for both submit buttons; each says which bound action it sends.
  const [state, dispatch] = useActionState(
    (previous: BuildingFormState, { formData, confirmed }: Submission) =>
      (confirmed ? confirmedAction : action)(previous, formData),
    initialState,
  )
  const formRef = useRef<HTMLFormElement>(null)
  const warningRef = useRef<HTMLDivElement>(null)
  // After an error or a question, what was typed; otherwise what is saved.
  const values = state.values ?? saved
  const change = state.confirmBillingChange

  // Focus is the DOM's, outside React: after a failed save it moves to the first error, and
  // when the billing month needs confirming, to the warning that explains it.
  useEffect(() => {
    if (state.confirmBillingChange) warningRef.current?.focus()
    else focusFirstError(formRef.current, fieldOrder, state.errors)
  }, [state])

  return (
    <form
      ref={formRef}
      action={(formData) => dispatch({ formData, confirmed: false })}
      className="flex flex-col gap-5"
    >
      <TextField
        name="name"
        label={t('name')}
        defaultValue={values.name}
        errors={state.errors?.name}
        required
        minLength={2}
        maxLength={80}
        autoComplete="off"
      />
      <TextField
        name="address"
        label={t('address')}
        defaultValue={values.address}
        errors={state.errors?.address}
        maxLength={160}
        autoComplete="off"
      />
      <TextField
        name="quorumPercent"
        label={t('quorumPercent')}
        hint={t('quorumHint')}
        defaultValue={values.quorumPercent}
        errors={state.errors?.quorumPercent}
        type="number"
        inputMode="numeric"
        min={1}
        max={100}
        step={1}
        required
      />
      <TextField
        name="billingStartMonth"
        label={t('billingStartMonth')}
        hint={t('billingStartHint')}
        defaultValue={values.billingStartMonth}
        errors={state.errors?.billingStartMonth}
        // Browsers without a month picker show a text field; the placeholder, the pattern, the
        // hint and the server all ask for YYYY-MM.
        type="month"
        placeholder="YYYY-MM"
        pattern="\d{4}-(0[1-9]|1[0-2])"
        required
      />
      <div aria-live="polite" aria-atomic="true">
        {change ? (
          <div
            ref={warningRef}
            tabIndex={-1}
            className="rounded-control border-warning-fill bg-surface flex flex-col gap-3 border p-4"
          >
            <p className="text-warning flex items-center gap-2 font-semibold">
              <ExclamationTriangleIcon aria-hidden className="size-5 shrink-0" />
              {t('confirmTitle')}
            </p>
            <p>
              {t('confirmBody', {
                from: formatMonth(change.from, locale),
                to: formatMonth(change.to, locale),
              })}
            </p>
            <div>
              <button
                type="submit"
                formAction={(formData) => dispatch({ formData, confirmed: true })}
                className={buttonClassName('secondary')}
              >
                {t('saveAnyway')}
              </button>
            </div>
          </div>
        ) : null}
      </div>
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
