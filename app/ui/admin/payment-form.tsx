'use client'

import clsx from 'clsx'
import { useLocale, useTranslations } from 'next-intl'
import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react'
import type { PaymentFormState } from '@/app/lib/actions/payments'
import type { OpenMonth, PaymentMethod } from '@/app/lib/definitions'
import { formatMonth } from '@/app/lib/utils/dates'
import { agorotToShekelsInput, formatAgorot } from '@/app/lib/utils/money'
import { focusFirstError } from '@/app/ui/focus-first-error'
import SubmitButton from '@/app/ui/submit-button'
import TextField, { inputClassName } from '@/app/ui/text-field'

export type PaymentAction = (
  state: PaymentFormState,
  formData: FormData,
) => Promise<PaymentFormState>

export type PaymentRecorded = NonNullable<PaymentFormState['recorded']>

type Props = {
  /** `record` with the locale and the apartment bound. */
  action: PaymentAction
  /** The months a payment can go to, oldest first (`data/payments.forApartment`). */
  months: OpenMonth[]
  /** Today in the building's time zone, `YYYY-MM-DD`: the default and the latest date paid. */
  today: string
  /** The earliest date paid, `YYYY-MM-DD`: a year before the apartment's billing starts. */
  firstDay: string
  /** Called with what was recorded. */
  onRecorded: (recorded: PaymentRecorded) => void
  /** The dialog's close button, placed beside the submit button. */
  cancel: ReactNode
}

const fieldOrder = ['months', 'amount', 'paidOn', 'method', 'note'] as const
const methods = ['transfer', 'bit', 'cash', 'check', 'other'] as const satisfies PaymentMethod[]

/** What the chosen months owe together, as it would be typed. Empty when none is chosen. */
function owedInput(months: OpenMonth[], chosen: string[]): string {
  const owed = months
    .filter(({ month }) => chosen.includes(month))
    .reduce((sum, month) => sum + month.remainingAgorot, 0)
  return owed > 0 ? agorotToShekelsInput(owed) : ''
}

/**
 * A payment for one or several months of one apartment (R15). The months owed so far (overdue
 * and due) start chosen, and the amount starts at what the chosen months owe; choosing other
 * months starts it again at what they owe. The server splits it oldest month first and refuses
 * more than they owe.
 */
export default function PaymentForm({
  action,
  months,
  today,
  firstDay,
  onRecorded,
  cancel,
}: Props) {
  const t = useTranslations('PaymentForm')
  const tMethods = useTranslations('PaymentMethods')
  const locale = useLocale()
  const initialState: PaymentFormState = {}
  const [state, formAction] = useActionState(
    async (previous: PaymentFormState, formData: FormData) => {
      const next = await action(previous, formData)
      if (next.recorded) onRecorded(next.recorded)
      return next
    },
    initialState,
  )
  // Which months are ticked: the amount follows them. The checkboxes stay uncontrolled (their
  // default is this), so the form's reset after each attempt keeps the choice.
  const [chosen, setChosen] = useState(() =>
    months.filter(({ kind }) => kind !== 'upcoming').map(({ month }) => month),
  )
  const formRef = useRef<HTMLFormElement>(null)
  const values = state.values
  const monthErrors = state.errors?.months
  const chosenKey = chosen.join(',')
  // After a failed attempt with these months, what was typed; otherwise what they owe.
  const amount =
    values && values.months.join(',') === chosenKey ? values.amount : owedInput(months, chosen)

  // Focus is the DOM's, outside React: after a failed attempt it moves to the first error.
  useEffect(() => {
    focusFirstError(formRef.current, fieldOrder, state.errors)
  }, [state])

  function toggle(month: string, checked: boolean) {
    setChosen((previous) =>
      checked ? [...previous, month].toSorted() : previous.filter((other) => other !== month),
    )
  }

  return (
    // The server checks every field and says how to fix it, in place of the browser.
    <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-5">
      <fieldset aria-describedby="months-hint months-error" className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t('months')}</legend>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {months.map((open) => (
            <li key={open.month}>
              <label
                className={clsx(
                  'rounded-control hover:border-text has-checked:border-accent has-checked:bg-surface has-focus-visible:outline-accent flex min-h-11 cursor-pointer items-start gap-3 border px-3 py-2 transition-[background-color,border-color,color] has-focus-visible:outline-2 has-focus-visible:outline-offset-2',
                  monthErrors ? 'border-danger' : 'border-text-muted',
                )}
              >
                <input
                  type="checkbox"
                  name="months"
                  value={open.month}
                  defaultChecked={chosen.includes(open.month)}
                  onChange={(event) => toggle(open.month, event.target.checked)}
                  className="accent-accent mt-1 size-4 shrink-0 focus-visible:outline-none"
                />
                <span className="flex flex-col">
                  <span className="font-medium">{formatMonth(open.month, locale)}</span>
                  <span
                    className={clsx(
                      'text-sm tabular-nums',
                      open.kind === 'overdue' ? 'text-danger' : 'text-text-muted',
                    )}
                  >
                    {t(open.kind)} ·{' '}
                    {open.paidAgorot > 0
                      ? t('left', {
                          amount: formatAgorot(open.remainingAgorot, locale),
                          due: formatAgorot(open.dueAgorot, locale),
                        })
                      : t('owed', { amount: formatAgorot(open.remainingAgorot, locale) })}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p id="months-hint" className="text-text-muted text-sm">
          {t('monthsHint')}
        </p>
        <div id="months-error" aria-live="polite" aria-atomic="true">
          {monthErrors?.map((error) => (
            <p key={error} className="text-danger text-sm">
              {error}
            </p>
          ))}
        </div>
      </fieldset>
      <TextField
        // Starts again at what the months owe whenever the choice changes.
        key={chosenKey}
        name="amount"
        label={t('amount')}
        hint={t('amountHint')}
        defaultValue={amount}
        errors={state.errors?.amount}
        inputMode="decimal"
        autoComplete="off"
        required
      />
      <TextField
        name="paidOn"
        label={t('paidOn')}
        defaultValue={values?.paidOn ?? today}
        errors={state.errors?.paidOn}
        type="date"
        min={firstDay}
        max={today}
        required
      />
      <div className="flex flex-col gap-2">
        <label htmlFor="method" className="text-sm font-medium">
          {t('method')}
        </label>
        <select
          id="method"
          name="method"
          // Keyed by what was sent, so a failed attempt shows the method chosen.
          key={values?.method}
          defaultValue={values?.method ?? methods[0]}
          aria-describedby="method-error"
          aria-invalid={state.errors?.method?.length ? true : undefined}
          required
          className={inputClassName}
        >
          {methods.map((method) => (
            <option key={method} value={method}>
              {tMethods(method)}
            </option>
          ))}
        </select>
        <div id="method-error" aria-live="polite" aria-atomic="true">
          {state.errors?.method?.map((error) => (
            <p key={error} className="text-danger text-sm">
              {error}
            </p>
          ))}
        </div>
      </div>
      <TextField
        name="note"
        label={t('note')}
        hint={t('noteHint')}
        defaultValue={values?.note}
        errors={state.errors?.note}
        maxLength={200}
        autoComplete="off"
      />
      <div aria-live="polite" aria-atomic="true">
        {state.message ? <p className="text-danger text-sm">{state.message}</p> : null}
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        {cancel}
        <SubmitButton pendingLabel={t('recording')}>{t('submit')}</SubmitButton>
      </div>
    </form>
  )
}
