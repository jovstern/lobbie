'use client'

import { BanknotesIcon } from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import type { ApartmentRef } from '@/app/lib/definitions'
import { formatMonth } from '@/app/lib/utils/dates'
import { formatAgorot } from '@/app/lib/utils/money'
import type { FeeAction, FeeSaved } from '@/app/ui/admin/fee-form'
import { LazyDialogSlot, lazyWithRetry, useLazyDialog } from '@/app/ui/admin/lazy-dialog'
import { buttonClassName, type ButtonVariant } from '@/app/ui/button-styles'

const FeeDialogContent = lazyWithRetry(() => import('@/app/ui/admin/fee-dialog-content'))

function preload() {
  void import('@/app/ui/admin/fee-dialog-content')
}

/** Whose fee the dialog sets: the building's, one apartment's, or one chosen in the form. */
export type FeeTarget =
  | { kind: 'building' }
  | { kind: 'apartment'; number: string }
  | { kind: 'chosen'; choices: ApartmentRef[] }

type Props = {
  action: FeeAction
  target: FeeTarget
  /** The month the form starts at, as `YYYY-MM`. */
  defaultMonth: string
  /**
   * The earliest month the server accepts, when it does not depend on a choice in the form:
   * billing start for a first fee, else the current month (past months keep their fee).
   */
  minMonth?: string
  variant?: ButtonVariant
}

/**
 * The button that sets a fee from a month, and its dialog, whose content loads on first open
 * (`lazy-dialog`). Focus moves into the form, and back to the button on close; what was set is
 * announced beside the button, which stays on the page.
 */
export default function FeeDialog({
  action,
  target,
  defaultMonth,
  minMonth,
  variant = 'secondary',
}: Props) {
  const t = useTranslations('FeeForm')
  const locale = useLocale()
  // What was last set since the dialog last opened, announced again for each save.
  const [saved, setSaved] = useState<{ fee: FeeSaved; count: number } | null>(null)
  const dialog = useLazyDialog({ preload, onOpen: () => setSaved(null) })

  const label =
    target.kind === 'building'
      ? t('openBuilding')
      : target.kind === 'apartment'
        ? t('openThisApartment')
        : t('openApartment')

  function announcement({ amountAgorot, effectiveFrom, apartmentNumber }: FeeSaved) {
    const words = {
      amount: formatAgorot(amountAgorot, locale),
      month: formatMonth(effectiveFrom, locale),
    }
    return apartmentNumber === null
      ? t('savedBuilding', words)
      : t('savedApartment', { ...words, number: apartmentNumber })
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button {...dialog.trigger} className={buttonClassName(variant)}>
        <BanknotesIcon aria-hidden className="size-5" />
        {label}
      </button>
      <LazyDialogSlot dialog={dialog}>
        <FeeDialogContent
          {...dialog.content}
          action={action}
          target={target}
          defaultMonth={defaultMonth}
          minMonth={minMonth}
          onSaved={(fee) => {
            dialog.setOpen(false)
            setSaved((previous) => ({ fee, count: (previous?.count ?? 0) + 1 }))
          }}
        />
      </LazyDialogSlot>
      <div role="status" aria-live="polite" aria-atomic="true">
        {saved ? (
          <p key={saved.count} className="text-success font-medium">
            {announcement(saved.fee)}
          </p>
        ) : null}
      </div>
    </div>
  )
}
