import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { requireMember } from '@/app/lib/authz'
import { history, monthlyStatus } from '@/app/lib/data/payments'
import { formatMonth } from '@/app/lib/utils/dates'
import Card from '@/app/ui/card'
import StandingHero from '@/app/ui/home/standing-hero'
import MonthList from '@/app/ui/money/month-list'
import PaymentHistory from '@/app/ui/money/payment-history'

/**
 * One of the person's apartments (R16): how it stands now, the focal point; its months, each
 * with its status; and every payment recorded for it.
 */
export default async function ApartmentMoney({ apartmentId }: { apartmentId: string }) {
  const [{ timeZone }, status, payments, t, locale] = await Promise.all([
    requireMember(),
    monthlyStatus(apartmentId),
    history(apartmentId),
    getTranslations('Money'),
    getLocale(),
  ])
  // Checked by the view already; the data says so too, for an apartment that is not theirs.
  if (!status || !payments) notFound()

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <div className="grid items-start gap-4 lg:grid-cols-2 lg:gap-6">
        <Card
          titleId="money-standing-title"
          title={t('apartment', { number: status.number })}
          heading="section"
        >
          <StandingHero
            standing={status.standing}
            monthName={formatMonth(status.currentMonth, locale)}
          />
        </Card>
        <MonthList months={status.months} currentMonth={status.currentMonth} />
      </div>
      <PaymentHistory payments={payments} number={status.number} timeZone={timeZone} />
    </div>
  )
}
