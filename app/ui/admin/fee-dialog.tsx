import { BanknotesIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import type { FeeAction } from '@/app/ui/admin/fee-form'
import LazyDialogButton, { type FeeTarget } from '@/app/ui/admin/lazy-dialog-button'
import type { ButtonVariant } from '@/app/ui/button-styles'

export type { FeeTarget }

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
export default function FeeDialog({ variant = 'secondary', ...dialog }: Props) {
  const t = useTranslations('FeeForm')
  const label =
    dialog.target.kind === 'building'
      ? t('openBuilding')
      : dialog.target.kind === 'apartment'
        ? t('openThisApartment')
        : t('openApartment')

  return (
    <LazyDialogButton dialog={{ kind: 'fee', ...dialog }} variant={variant}>
      <BanknotesIcon aria-hidden className="size-5" />
      {label}
    </LazyDialogButton>
  )
}
