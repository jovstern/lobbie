import { NoSymbolIcon } from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import { formatDay } from '@/app/lib/utils/dates'
import { formatAgorot } from '@/app/lib/utils/money'
import LazyDialogButton from '@/app/ui/admin/lazy-dialog-button'
import type { VoidAction } from '@/app/ui/admin/void-dialog-content'

type Props = {
  /** `voidExpense` with the locale and the expense bound. */
  action: VoidAction
  /** The expense's description, date (`YYYY-MM-DD`) and amount, to name it. */
  description: string
  spentOn: string
  amountAgorot: number
  /** Whether it has a receipt, which the confirmation says stays listed. */
  hasReceipt: boolean
}

/**
 * An expense's "Void" and its confirmation, which asks why (R18). Once voided the expense stays
 * listed without this button, so focus goes to the list's heading and the page's status region
 * says what happened.
 */
export default function VoidExpenseDialog({
  action,
  description,
  spentOn,
  amountAgorot,
  hasReceipt,
}: Props) {
  const t = useTranslations('VoidExpense')
  const locale = useLocale()
  const words = { description, amount: formatAgorot(amountAgorot, locale) }

  return (
    <LazyDialogButton
      dialog={{
        kind: 'void',
        action,
        subject: { kind: 'expense', description, amountAgorot, hasReceipt },
      }}
      // Recurring expenses share a description: the date tells their buttons apart.
      label={t('openLabel', { ...words, date: formatDay(spentOn, locale) })}
      variant="ghost"
      status="announcer"
      leaves
    >
      <NoSymbolIcon aria-hidden className="size-5" />
      {t('open')}
    </LazyDialogButton>
  )
}
