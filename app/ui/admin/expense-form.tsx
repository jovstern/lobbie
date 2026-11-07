'use client'

import { PaperClipIcon } from '@heroicons/react/20/solid'
import { useLocale, useTranslations } from 'next-intl'
import { useActionState, useEffect, useRef, useState } from 'react'
import type { ExpenseFormState } from '@/app/lib/actions/expenses'
import type { ExpenseCategory } from '@/app/lib/definitions'
import { formatAgorot } from '@/app/lib/utils/money'
import { maxReceiptBytes } from '@/app/lib/utils/receipt-file'
import { useAnnouncer } from '@/app/ui/admin/admin-announcer'
import { focusFirstError } from '@/app/ui/focus-first-error'
import SubmitButton from '@/app/ui/submit-button'
import TextField, { inputClassName } from '@/app/ui/text-field'

export type ExpenseAction = (
  state: ExpenseFormState,
  formData: FormData,
) => Promise<ExpenseFormState>

type Props = {
  /** `record` with the locale bound. */
  action: ExpenseAction
  /** Today in the building's time zone, `YYYY-MM-DD`: the default and the latest date. */
  today: string
  /** The earliest date an expense may carry, `YYYY-MM-DD`. */
  firstDay: string
}

const fieldOrder = ['category', 'amount', 'spentOn', 'description', 'receipt'] as const
const categories = [
  'cleaning',
  'garden',
  'elevator',
  'electricity',
  'water',
  'repairs',
  'insurance',
  'other',
] as const satisfies ExpenseCategory[]
// What the picker offers; the server still checks the bytes, whatever the browser allowed.
const receiptAccept = '.jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf'

/**
 * A new expense (R18), on the page rather than in a dialog: the category, amount, date and what
 * it was for, and its receipt. Once added, the page's status region says so and the form
 * empties for the next one; after a refusal it keeps what was typed, but a browser cannot keep
 * a chosen file, so it asks for the receipt again.
 */
export default function ExpenseForm({ action, today, firstDay }: Props) {
  const t = useTranslations('ExpenseForm')
  const tCategories = useTranslations('ExpenseCategories')
  const locale = useLocale()
  const { announce } = useAnnouncer()
  // A file over 4 MB is refused as soon as it is chosen: sent, it would exceed the request
  // limit before the server could say why.
  const [tooLarge, setTooLarge] = useState(false)
  // The chosen file's name, shown in the picker's own words rather than the browser's.
  const [fileName, setFileName] = useState<string | null>(null)
  const initialState: ExpenseFormState = {}
  const [state, formAction] = useActionState(
    async (previous: ExpenseFormState, formData: FormData) => {
      setTooLarge(false)
      // No file chosen still sends an empty file part; without one, there is no receipt.
      const receipt = formData.get('receipt')
      if (receipt instanceof File && receipt.size === 0) formData.delete('receipt')
      const next = await action(previous, formData)
      // The form empties after each attempt, the file with it.
      setFileName(null)
      if (next.recorded) {
        const amount = formatAgorot(next.recorded.amountAgorot, locale)
        announce(t('recorded', { description: next.recorded.description, amount }))
      }
      return next
    },
    initialState,
  )
  const formRef = useRef<HTMLFormElement>(null)
  const values = state.values
  const receiptErrors = tooLarge
    ? [t('receiptTooLarge')]
    : (state.errors?.receipt ??
      (values?.receiptName ? [t('receiptAgain', { name: values.receiptName })] : undefined))

  // Focus is the DOM's, outside React: after a failed attempt it moves to the first error.
  useEffect(() => {
    focusFirstError(formRef.current, fieldOrder, state.errors)
  }, [state])

  return (
    // The server checks every field and says how to fix it, in place of the browser.
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="category" className="text-sm font-medium">
          {t('category')}
        </label>
        <select
          id="category"
          name="category"
          // Keyed by what was sent, so a failed attempt shows the category chosen.
          key={values?.category}
          defaultValue={values?.category ?? ''}
          aria-describedby="category-error"
          aria-invalid={state.errors?.category?.length ? true : undefined}
          required
          className={inputClassName}
        >
          <option value="" disabled>
            {t('chooseCategory')}
          </option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {tCategories(category)}
            </option>
          ))}
        </select>
        <div id="category-error" aria-live="polite" aria-atomic="true">
          {state.errors?.category?.map((error) => (
            <p key={error} className="text-danger text-sm">
              {error}
            </p>
          ))}
        </div>
      </div>
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
        name="spentOn"
        label={t('spentOn')}
        defaultValue={values?.spentOn ?? today}
        errors={state.errors?.spentOn}
        type="date"
        min={firstDay}
        max={today}
        required
      />
      <TextField
        name="description"
        label={t('description')}
        hint={t('descriptionHint')}
        defaultValue={values?.description}
        errors={state.errors?.description}
        maxLength={200}
        autoComplete="off"
        required
      />
      <div className="flex flex-col gap-2 sm:col-span-2">
        {/* The input is the control (focus, keyboard, screen readers); the label draws it in
            the page's language, as browsers draw "Choose file" in their own. */}
        <input
          id="receipt"
          name="receipt"
          type="file"
          accept={receiptAccept}
          aria-describedby="receipt-hint receipt-error"
          aria-invalid={receiptErrors ? true : undefined}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            const over = file !== undefined && file.size > maxReceiptBytes
            setTooLarge(over)
            if (over) event.currentTarget.value = ''
            setFileName(over ? null : (file?.name ?? null))
          }}
          className="peer sr-only"
        />
        <label htmlFor="receipt" className="order-first text-sm font-medium">
          {t('receipt')}
        </label>
        <label
          htmlFor="receipt"
          aria-hidden
          className="rounded-control border-text-muted bg-surface hover:border-text peer-focus-visible:outline-accent peer-aria-invalid:border-danger flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 border border-dashed px-3 py-2 transition-[border-color] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2"
        >
          <span className="rounded-control border-text-muted bg-surface-raised inline-flex min-h-9 items-center gap-1.5 border px-3 font-medium">
            <PaperClipIcon className="size-4 shrink-0" />
            {t('chooseFile')}
          </span>
          <span className={fileName ? 'min-w-0 break-all' : 'text-text-muted'}>
            <bdi>{fileName ?? t('noFile')}</bdi>
          </span>
        </label>
        <p id="receipt-hint" className="text-text-muted text-sm">
          {t('receiptHint')}
        </p>
        <div id="receipt-error" aria-live="polite" aria-atomic="true">
          {receiptErrors?.map((error) => (
            <p key={error} className="text-danger text-sm">
              {error}
            </p>
          ))}
        </div>
      </div>
      <div aria-live="polite" aria-atomic="true" className="sm:col-span-2">
        {state.message ? <p className="text-danger text-sm">{state.message}</p> : null}
      </div>
      <div className="sm:col-span-2">
        <SubmitButton pendingLabel={t('recording')} className="max-sm:w-full">
          {t('submit')}
        </SubmitButton>
      </div>
    </form>
  )
}
