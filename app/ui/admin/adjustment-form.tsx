'use client'

import clsx from 'clsx'
import { useTranslations } from 'next-intl'
import { useActionState, useEffect, useRef, type ReactNode } from 'react'
import type { AdjustmentFormState } from '@/app/lib/actions/buildings'
import { focusFirstError } from '@/app/ui/focus-first-error'
import SubmitButton from '@/app/ui/submit-button'
import TextField from '@/app/ui/text-field'

export type AdjustmentAction = (
  state: AdjustmentFormState,
  formData: FormData,
) => Promise<AdjustmentFormState>

type Props = {
  /** `addAdjustment` with the page's locale bound. */
  action: AdjustmentAction
  /** Called once the adjustment is recorded. */
  onAdded: () => void
  /** The dialog's close button, placed beside the submit button. */
  cancel: ReactNode
}

const fieldOrder = ['direction', 'amount', 'reason'] as const
const directions = ['in', 'out'] as const

/** Money in or out of the fund, an amount and a reason (R7). */
export default function AdjustmentForm({ action, onAdded, cancel }: Props) {
  const t = useTranslations('AdjustmentForm')
  const initialState: AdjustmentFormState = {}
  const [state, formAction] = useActionState(
    async (previous: AdjustmentFormState, formData: FormData) => {
      const next = await action(previous, formData)
      if (next.added) onAdded()
      return next
    },
    initialState,
  )
  const formRef = useRef<HTMLFormElement>(null)
  const values = state.values
  const directionErrors = state.errors?.direction

  // Focus is the DOM's, outside React: after a failed attempt it moves to the first error.
  useEffect(() => {
    focusFirstError(formRef.current, fieldOrder, state.errors)
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5">
      <fieldset aria-describedby="direction-error" className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t('direction')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {directions.map((direction) => (
            <label
              key={direction}
              className={clsx(
                'rounded-control hover:border-text has-checked:border-accent has-checked:bg-surface has-focus-visible:outline-accent flex min-h-11 cursor-pointer items-center gap-2 border px-3 font-medium transition-[background-color,border-color,color] has-focus-visible:outline-2 has-focus-visible:outline-offset-2',
                directionErrors ? 'border-danger' : 'border-text-muted',
              )}
            >
              <input
                type="radio"
                name="direction"
                value={direction}
                required
                defaultChecked={values?.direction === direction}
                className="accent-accent size-4 shrink-0 focus-visible:outline-none"
              />
              {t(direction)}
            </label>
          ))}
        </div>
        <div id="direction-error" aria-live="polite" aria-atomic="true">
          {directionErrors?.map((error) => (
            <p key={error} className="text-danger text-sm">
              {error}
            </p>
          ))}
        </div>
      </fieldset>
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
        name="reason"
        label={t('reason')}
        hint={t('reasonHint')}
        defaultValue={values?.reason}
        errors={state.errors?.reason}
        minLength={3}
        maxLength={200}
        autoComplete="off"
        required
      />
      <div aria-live="polite" aria-atomic="true">
        {state.message ? <p className="text-danger text-sm">{state.message}</p> : null}
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        {cancel}
        <SubmitButton pendingLabel={t('adding')}>{t('submit')}</SubmitButton>
      </div>
    </form>
  )
}
