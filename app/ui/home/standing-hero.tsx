import { CalendarIcon } from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import type { ApartmentStanding } from '@/app/lib/definitions'
import { formatAgorot } from '@/app/lib/utils/money'
import StatusChip from '@/app/ui/home/status-chip'

type Props = { standing: ApartmentStanding; monthName: string }

const figure = 'text-display font-semibold tabular-nums'

/** One apartment's standing, as the focal point of Home. */
export default function StandingHero({ standing, monthName }: Props) {
  const t = useTranslations('StatusCard')
  const locale = useLocale()

  switch (standing.kind) {
    case 'paid':
      return (
        <>
          <StatusChip kind="paid" />
          <p className="text-2xl font-semibold">{t('paidUpFor', { month: monthName })}</p>
        </>
      )
    case 'due':
      return (
        <>
          <StatusChip kind="due" />
          <div className="flex flex-col gap-1">
            <p className={figure}>{formatAgorot(standing.remainingAgorot, locale)}</p>
            <p className="text-text-muted">
              {t(standing.partial ? 'partialFor' : 'dueFor', { month: monthName })}
            </p>
          </div>
        </>
      )
    case 'overdue':
      return (
        <>
          <StatusChip kind="overdue" />
          <div className="flex flex-col gap-1">
            <p className="text-text-muted">{t('totalOwed')}</p>
            <p className={figure}>{formatAgorot(standing.totalOwedAgorot, locale)}</p>
            <p className="text-danger font-medium">
              {t('monthsBehind', { count: standing.monthsBehind })}
            </p>
          </div>
        </>
      )
    case 'no-fee':
      return (
        <>
          <StatusChip kind="no-fee" />
          <p>{t('noFeeBody', { month: monthName })}</p>
        </>
      )
    case 'not-billed':
      return (
        <div className="flex flex-col items-start gap-2">
          <CalendarIcon aria-hidden className="text-text-muted size-8" />
          <p className="text-lg font-semibold">{t('notBilledTitle')}</p>
          <p className="text-text-muted">{t('notBilledBody')}</p>
        </div>
      )
  }
}
