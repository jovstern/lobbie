import { HomeModernIcon } from '@heroicons/react/24/outline'
import { useLocale, useTranslations } from 'next-intl'
import type { ApartmentStatus } from '@/app/lib/definitions'
import { formatMonth } from '@/app/lib/utils/dates'
import { apartmentStanding } from '@/app/lib/utils/status'
import Card, { homeCardHeights } from '@/app/ui/card'
import CardLink from '@/app/ui/home/card-link'
import StandingHero from '@/app/ui/home/standing-hero'
import StandingRow from '@/app/ui/home/standing-row'

export type ApartmentStatusRow = { id: string; status: ApartmentStatus }

type Props = {
  /** The current month (`YYYY-MM`) in the building's time zone. */
  month: string
  /** The member's apartments, in order. */
  apartments: ApartmentStatusRow[]
}

/** Whether the member is paid up: one apartment in full, several as one row each. */
export default function StatusSummary({ month, apartments }: Props) {
  const t = useTranslations('StatusCard')
  const monthName = formatMonth(month, useLocale())
  const [only] = apartments

  return (
    <Card titleId="status-card-title" title={t('title')} minHeight={homeCardHeights.status}>
      {apartments.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <HomeModernIcon aria-hidden className="text-text-muted size-8" />
          <p className="text-lg font-semibold">{t('noApartmentTitle')}</p>
          <p className="text-text-muted">{t('noApartmentBody')}</p>
        </div>
      ) : apartments.length === 1 ? (
        <StandingHero standing={apartmentStanding(only.status)} monthName={monthName} />
      ) : (
        <ul className="divide-border flex flex-col divide-y">
          {apartments.map((apartment) => (
            <StandingRow
              key={apartment.id}
              number={apartment.status.number}
              standing={apartmentStanding(apartment.status)}
              monthName={monthName}
            />
          ))}
        </ul>
      )}
      {apartments.length > 0 ? <CardLink href="/money">{t('details')}</CardLink> : null}
    </Card>
  )
}
