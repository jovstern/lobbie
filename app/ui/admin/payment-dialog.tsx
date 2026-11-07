import { BanknotesIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import type { OpenMonth } from '@/app/lib/definitions'
import LazyDialogButton from '@/app/ui/admin/lazy-dialog-button'
import type { PaymentAction } from '@/app/ui/admin/payment-form'
import type { ButtonVariant } from '@/app/ui/button-styles'

type Props = {
  /** `record` with the locale and the apartment bound. */
  action: PaymentAction
  /** The apartment's number, for the dialog's title and the button's name. */
  number: string
  /** The months a payment can go to, oldest first (`data/payments.forApartment`). */
  months: OpenMonth[]
  /** Today in the building's time zone, `YYYY-MM-DD`. */
  today: string
  /** The earliest date paid, `YYYY-MM-DD`: a year before the apartment's billing starts. */
  firstDay: string
  /** The last month a payment may go to (a year ahead). */
  lastMonth: string
  variant?: ButtonVariant
}

/**
 * "Record a payment" for one apartment, and its dialog, whose content loads on first open
 * (`lazy-dialog`). The apartment is bound: its page, or the apartment opened on the payments
 * grid, renders one. Focus moves into the form, and back to the button on close; what was
 * recorded is announced in the apartment's payments, where a void is announced too.
 */
export default function PaymentDialog({ variant = 'primary', ...dialog }: Props) {
  const t = useTranslations('PaymentForm')

  return (
    <LazyDialogButton
      dialog={{ kind: 'payment', ...dialog }}
      label={t('openLabel', { number: dialog.number })}
      variant={variant}
      status="announcer"
    >
      <BanknotesIcon aria-hidden className="size-5" />
      {t('open')}
    </LazyDialogButton>
  )
}
