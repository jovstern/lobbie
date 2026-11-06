import { ChevronRightIcon } from '@heroicons/react/24/outline'
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

/** The apartments as cards, on phones and tablets; wide screens get `ApartmentTable`. */
export default async function ApartmentCards({ apartments, buildingMonth, timeZone }: Props) {
  const [t, locale] = await Promise.all([getTranslations('AdminApartments'), getLocale()])

  return (
    <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
      {apartments.map((apartment) => (
        <li
          key={apartment.id}
          className="rounded-card border-border bg-surface-raised shadow-card flex flex-col gap-3 border p-4"
        >
          <h2 className="text-lg font-semibold">
            <Link
              href={`/admin/apartments/${apartment.id}`}
              className="hover:text-accent flex min-h-11 items-center justify-between gap-3"
            >
              {t('apartmentTitle', { number: apartment.number })}
              <ChevronRightIcon
                aria-hidden
                className="text-text-muted size-5 shrink-0 rtl:-scale-x-100"
              />
            </Link>
          </h2>
          <dl className="text-text-muted flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <div>
              <dt className="sr-only">{t('floor')}</dt>
              <dd>{t('floorValue', { floor: apartment.floor })}</dd>
            </div>
            <div>
              <dt className="sr-only">{t('residents')}</dt>
              <dd>{t('residentCount', { count: apartment.residents })}</dd>
            </div>
            <div className="flex gap-1">
              <dt>{t('billingStart')}:</dt>
              <dd>
                {apartment.billingStartMonth
                  ? formatMonth(apartment.billingStartMonth, locale)
                  : t('buildingDefault', { month: formatMonth(buildingMonth, locale) })}
              </dd>
            </div>
            <div className="flex gap-1">
              <dt>{t('invite')}:</dt>
              <dd>
                <InviteStandingText standing={inviteStanding(apartment)} timeZone={timeZone} />
              </dd>
            </div>
          </dl>
          <ApartmentRowActions apartment={apartment} layout="cards" />
        </li>
      ))}
    </ul>
  )
}
