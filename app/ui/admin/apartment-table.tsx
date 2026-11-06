import { getLocale, getTranslations } from 'next-intl/server'
import type { ApartmentListItem } from '@/app/lib/definitions'
import { formatMonth } from '@/app/lib/utils/dates'
import { inviteStanding } from '@/app/lib/utils/invite-standing'
import ApartmentRowActions from '@/app/ui/admin/apartment-row-actions'
import InviteStandingText from '@/app/ui/admin/invite-standing-text'
import { Link } from '@/i18n/navigation'

type Props = {
  apartments: ApartmentListItem[]
  /** The building's billing start, which an apartment without its own follows. */
  buildingMonth: string
  /** The building's time zone, for the invites' expiry dates. */
  timeZone: string
}

/** The apartments as a table, on wide screens; narrower ones get `ApartmentCards`. */
export default async function ApartmentTable({ apartments, buildingMonth, timeZone }: Props) {
  const [t, locale] = await Promise.all([getTranslations('AdminApartments'), getLocale()])
  const header = 'text-text-muted px-4 py-3 text-start text-sm font-medium whitespace-nowrap'
  const cell = 'px-4 py-3 align-top'
  const textCell = `${cell} pt-5`

  return (
    <div className="rounded-card border-border bg-surface-raised shadow-card hidden overflow-x-auto border lg:block">
      <table className="w-full border-collapse">
        <caption className="sr-only">{t('tableLabel')}</caption>
        <thead>
          <tr className="border-border border-b">
            <th scope="col" className={header}>
              {t('number')}
            </th>
            <th scope="col" className={header}>
              {t('floor')}
            </th>
            <th scope="col" className={header}>
              {t('billingStart')}
            </th>
            <th scope="col" className={header}>
              {t('residents')}
            </th>
            <th scope="col" className={header}>
              {t('invite')}
            </th>
            <th scope="col" className={header}>
              <span className="sr-only">{t('actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {apartments.map((apartment) => (
            <tr key={apartment.id}>
              <th scope="row" className={`${cell} text-start font-semibold whitespace-nowrap`}>
                <Link
                  href={`/admin/apartments/${apartment.id}`}
                  aria-label={t('apartmentTitle', { number: apartment.number })}
                  className="text-accent inline-flex min-h-11 min-w-11 items-center underline-offset-4 hover:underline"
                >
                  {apartment.number}
                </Link>
              </th>
              <td className={`${textCell} tabular-nums`}>{apartment.floor}</td>
              <td className={`${textCell} whitespace-nowrap tabular-nums`}>
                {apartment.billingStartMonth ? (
                  formatMonth(apartment.billingStartMonth, locale)
                ) : (
                  <span className="text-text-muted">
                    {t('buildingDefault', { month: formatMonth(buildingMonth, locale) })}
                  </span>
                )}
              </td>
              <td className={`${textCell} tabular-nums`}>{apartment.residents}</td>
              <td className={textCell}>
                <InviteStandingText standing={inviteStanding(apartment)} timeZone={timeZone} />
              </td>
              <td className={cell}>
                <ApartmentRowActions apartment={apartment} layout="table" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
