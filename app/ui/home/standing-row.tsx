import { useLocale, useTranslations } from 'next-intl'
import type { ApartmentStanding } from '@/app/lib/definitions'
import { formatAgorot } from '@/app/lib/utils/money'
import StatusChip from '@/app/ui/home/status-chip'

type Props = { number: string; standing: ApartmentStanding; monthName: string }

/** One apartment, compactly, for someone who lives in several. */
export default function StandingRow({ number, standing, monthName }: Props) {
  const t = useTranslations('StatusCard')
  const locale = useLocale()

  function detail(): string | null {
    switch (standing.kind) {
      case 'paid':
        return t('rowPaid', { month: monthName })
      case 'due':
        return t('rowDue', { amount: formatAgorot(standing.remainingAgorot, locale) })
      case 'overdue':
        return t('rowOverdue', {
          amount: formatAgorot(standing.totalOwedAgorot, locale),
          count: standing.monthsBehind,
        })
      // The chip says it all.
      case 'no-fee':
      case 'not-billed':
        return null
    }
  }
  const text = detail()

  return (
    <li className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{t('apartment', { number })}</span>
        <StatusChip kind={standing.kind} />
      </div>
      {text ? <p className="text-text-muted text-sm tabular-nums">{text}</p> : null}
    </li>
  )
}
