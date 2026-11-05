import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { update } from '@/app/lib/actions/apartments'
import { requireRole } from '@/app/lib/authz'
import { get } from '@/app/lib/data/apartments'
import { formatMonth } from '@/app/lib/utils/dates'
import ApartmentDialog from '@/app/ui/admin/apartment-dialog'
import ApartmentInvite from '@/app/ui/admin/apartment-invite'
import ApartmentResidents from '@/app/ui/admin/apartment-residents'
import AdminAnnouncer from '@/app/ui/admin/admin-announcer'
import { Link } from '@/i18n/navigation'

const headingId = 'apartment-title'

type Props = { params: Promise<{ id: string }> }

/**
 * `/admin/apartments/[id]` for an admin: the apartment's header, its invite, then its residents.
 * Another building's apartment, or none, is a 404.
 */
export default async function ApartmentDetails({ params }: Props) {
  // Admins only; anyone else gets the 404, before anything of the building is read.
  await requireRole('admin')
  const { id } = await params
  const [apartment, t, locale] = await Promise.all([
    get(id),
    getTranslations('AdminApartments'),
    getLocale(),
  ])
  if (!apartment) notFound()

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/admin/apartments"
        className="text-accent inline-flex min-h-11 items-center gap-2 self-start font-medium underline-offset-4 hover:underline"
      >
        <ArrowLeftIcon aria-hidden className="size-5 rtl:-scale-x-100" />
        {t('back')}
      </Link>
      <AdminAnnouncer
        headingId={headingId}
        header={
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h1 id={headingId} tabIndex={-1} className="text-2xl font-semibold">
                {t('apartmentTitle', { number: apartment.number })}
              </h1>
              <dl className="text-text-muted flex flex-wrap gap-x-6 gap-y-1">
                <div>
                  <dt className="sr-only">{t('floor')}</dt>
                  <dd>{t('floorValue', { floor: apartment.floor })}</dd>
                </div>
                <div className="flex gap-1">
                  <dt>{t('billingStart')}:</dt>
                  <dd>
                    {apartment.billingStartMonth
                      ? formatMonth(apartment.billingStartMonth, locale)
                      : t('buildingDefault')}
                  </dd>
                </div>
              </dl>
            </div>
            <ApartmentDialog
              action={update.bind(null, locale, apartment.id, false)}
              confirmedAction={update.bind(null, locale, apartment.id, true)}
              saved={{
                number: apartment.number,
                floor: String(apartment.floor),
                billingStartMonth: apartment.billingStartMonth ?? '',
              }}
            />
          </header>
        }
      >
        <ApartmentInvite apartment={apartment} />
        <ApartmentResidents apartment={apartment} />
      </AdminAnnouncer>
    </div>
  )
}
