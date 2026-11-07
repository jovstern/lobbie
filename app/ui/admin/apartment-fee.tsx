import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { followBuilding, setOverride } from '@/app/lib/actions/fees'
import { requireRole } from '@/app/lib/authz'
import { get } from '@/app/lib/data/apartments'
import { get as getBuilding } from '@/app/lib/data/buildings'
import { forApartment } from '@/app/lib/data/fees'
import { addMonths, formatMonth } from '@/app/lib/utils/dates'
import { followBuildingMonth } from '@/app/lib/utils/fees'
import { formatAgorot } from '@/app/lib/utils/money'
import FeeDialog from '@/app/ui/admin/fee-dialog'
import FeeHistory from '@/app/ui/admin/fee-history'
import FollowBuildingDialog from '@/app/ui/admin/follow-building-dialog'

/**
 * The apartment's monthly fee (R14), inside the page's static Fee card: what it pays now and
 * whose fee that is, the building's next change when it will pay it, and its own fees, with
 * the button that sets a new one from a month.
 */
export default async function ApartmentFee({ apartmentId }: { apartmentId: Promise<string> }) {
  const id = await apartmentId
  const [{ timeZone }, apartment, fees, building, t, tFees, locale] = await Promise.all([
    requireRole('admin'),
    get(id),
    forApartment(id),
    getBuilding(),
    getTranslations('ApartmentFee'),
    getTranslations('AdminFees'),
    getLocale(),
  ])
  if (!apartment || !fees) notFound()

  // Next month by default, never before the apartment's billing starts.
  const billingStart = apartment.billingStartMonth ?? building.billingStartMonth
  const nextMonth = addMonths(fees.currentMonth, 1)
  // Its first own fee may start with billing; later ones not before this month (spec §3).
  const minMonth =
    fees.periods.length === 0 || billingStart > fees.currentMonth ? billingStart : fees.currentMonth
  const upcoming = fees.upcomingBuildingFee
  // Offered while it has an own fee to end; null once it follows the building.
  const followFrom = followBuildingMonth(fees.periods, fees.currentMonth)

  return (
    <div className="flex flex-col gap-4">
      {fees.inForce ? (
        <div className="flex flex-col gap-1">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-2xl font-semibold tabular-nums">
              {formatAgorot(fees.inForce.amountAgorot, locale)}
            </span>
            <span className="text-text-muted">{tFees('perMonth')}</span>
          </p>
          <p className="text-text-muted">
            {fees.inForce.source === 'apartment' ? t('own') : t('building')}
          </p>
        </div>
      ) : (
        <p>{t('none')}</p>
      )}
      {upcoming ? (
        <p>
          {t('upcomingBuilding', {
            amount: formatAgorot(upcoming.amountAgorot, locale),
            month: formatMonth(upcoming.effectiveFrom, locale),
          })}
        </p>
      ) : null}
      <div className="flex flex-wrap items-start gap-3">
        <FeeDialog
          action={setOverride.bind(null, locale, apartment.id)}
          target={{ kind: 'apartment', number: apartment.number }}
          defaultMonth={billingStart > nextMonth ? billingStart : nextMonth}
          minMonth={minMonth}
        />
        {followFrom ? (
          <FollowBuildingDialog
            action={followBuilding.bind(null, locale, apartment.id, followFrom)}
            number={apartment.number}
            month={followFrom}
          />
        ) : null}
      </div>
      {fees.periods.length > 0 ? (
        <section aria-labelledby="apartment-own-fees-title" className="flex flex-col gap-3">
          <h3 id="apartment-own-fees-title" className="text-base font-semibold">
            {t('historyTitle')}
          </h3>
          <FeeHistory periods={fees.periods} timeZone={timeZone} />
        </section>
      ) : (
        <p className="text-text-muted">{t('noOwnFees')}</p>
      )}
    </div>
  )
}
