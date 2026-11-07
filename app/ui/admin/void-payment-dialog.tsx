import { NoSymbolIcon } from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import { formatMonth } from '@/app/lib/utils/dates'
import { formatAgorot } from '@/app/lib/utils/money'
import LazyDialogButton from '@/app/ui/admin/lazy-dialog-button'
import type { VoidAction } from '@/app/ui/admin/void-dialog-content'

type Props = {
  /** `voidPayment` with the locale and the payment bound. */
  action: VoidAction
  /** The payment's month, `YYYY-MM`, and amount, to name it. */
  month: string
  amountAgorot: number
}

/**
 * A payment's "Void" and its confirmation, which asks why (R15). Once voided the payment stays
 * listed without this button, so focus goes to the apartment's payments heading and its status
 * region says what happened, where "Record a payment" says it too.
 */
export default function VoidPaymentDialog({ action, month, amountAgorot }: Props) {
  const t = useTranslations('VoidPayment')
  const locale = useLocale()
  const words = { month: formatMonth(month, locale), amount: formatAgorot(amountAgorot, locale) }

  return (
    <LazyDialogButton
      dialog={{ kind: 'void', action, subject: { kind: 'payment', month, amountAgorot } }}
      label={t('openLabel', words)}
      variant="ghost"
      status="announcer"
      leaves
    >
      <NoSymbolIcon aria-hidden className="size-5" />
      {t('open')}
    </LazyDialogButton>
  )
}
