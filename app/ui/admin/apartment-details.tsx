import { ArrowLeftIcon, BanknotesIcon, LinkIcon, UsersIcon } from '@heroicons/react/24/outline'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { Suspense, type ReactNode } from 'react'
import { update } from '@/app/lib/actions/apartments'
import { requireRole } from '@/app/lib/authz'
import { get } from '@/app/lib/data/apartments'
import { get as getBuilding } from '@/app/lib/data/buildings'
import { formatMonth } from '@/app/lib/utils/dates'
import AdminAnnouncer from '@/app/ui/admin/admin-announcer'
import ApartmentDialog from '@/app/ui/admin/apartment-dialog'
import ApartmentFee from '@/app/ui/admin/apartment-fee'
import ApartmentInvite from '@/app/ui/admin/apartment-invite'
import ApartmentResidents from '@/app/ui/admin/apartment-residents'
import { cardClassName } from '@/app/ui/card'
import {
  ApartmentFactsSkeleton,
  ApartmentFeeSkeleton,
  ApartmentInviteSkeleton,
  ApartmentNumberSkeleton,
  ApartmentResidentsSkeleton,
} from '@/app/ui/skeletons'
import { Link } from '@/i18n/navigation'

const headingId = 'apartment-title'

/** The apartment's number, for the heading. */
async function ApartmentNumber({ apartmentId }: { apartmentId: Promise<string> }) {
  const apartment = await get(await apartmentId)
  if (!apartment) notFound()
  return apartment.number
}

/** The apartment's floor and billing start, with its Edit button. */
async function ApartmentFacts({ apartmentId }: { apartmentId: Promise<string> }) {
  const [apartment, building, t, locale] = await Promise.all([
    apartmentId.then(get),
    getBuilding(),
    getTranslations('AdminApartments'),
    getLocale(),
  ])
  if (!apartment) notFound()

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
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
              : t('buildingDefault', { month: formatMonth(building.billingStartMonth, locale) })}
          </dd>
        </div>
      </dl>
      <ApartmentDialog
        action={update.bind(null, locale, apartment.id, false)}
        confirmedAction={update.bind(null, locale, apartment.id, true)}
        saved={{
          number: apartment.number,
          floor: String(apartment.floor),
          billingStartMonth: apartment.billingStartMonth ?? '',
        }}
      />
    </div>
  )
}

type Props = {
  /** The apartment's id from the URL. */
  apartmentId: Promise<string>
}

/**
 * `/admin/apartments/[id]` for an admin: the apartment's header, its invite, its residents, then
 * its monthly fee.
 * Rendered after the role check (the page streams it behind a placeholder that names nothing);
 * then the number, the facts, the invite, the residents and the fee stream in, each checking the
 * apartment: an id that is not one of the building's apartments gets the 404.
 */
export default async function ApartmentDetails({ apartmentId }: Props) {
  // Admins only, before anything names the page; anyone else gets the 404.
  await requireRole('admin')
  const [t, tInvite, tResidents, tFee] = await Promise.all([
    getTranslations('AdminApartments'),
    getTranslations('InviteAdmin'),
    getTranslations('Residents'),
    getTranslations('ApartmentFee'),
  ])
  // What reads the apartment streams in behind a placeholder of its shape.
  const streamed = (fallback: ReactNode, content: (id: Promise<string>) => ReactNode) => (
    <Suspense fallback={fallback}>{content(apartmentId)}</Suspense>
  )

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
          <header className="flex flex-col gap-2">
            {/* Focusable from script: it takes focus when the button that had it is gone. */}
            <h1 id={headingId} tabIndex={-1} className="text-2xl font-semibold">
              {t.rich('apartmentHeading', {
                number: () =>
                  streamed(<ApartmentNumberSkeleton />, (id) => (
                    <ApartmentNumber apartmentId={id} />
                  )),
              })}
            </h1>
            {streamed(<ApartmentFactsSkeleton />, (id) => (
              <ApartmentFacts apartmentId={id} />
            ))}
          </header>
        }
      >
        <section aria-labelledby="invite-title" className={`${cardClassName} max-w-2xl`}>
          <div className="flex flex-col gap-1">
            <h2 id="invite-title" className="flex items-center gap-2 text-lg font-semibold">
              <LinkIcon aria-hidden className="text-text-muted size-5" />
              {tInvite('title')}
            </h2>
            <p className="text-text-muted">{tInvite('lead')}</p>
          </div>
          {streamed(<ApartmentInviteSkeleton />, (id) => (
            <ApartmentInvite apartmentId={id} />
          ))}
          <p className="text-text-muted text-sm">{tInvite('onceNote')}</p>
        </section>
        <section aria-labelledby="residents-title" className={`${cardClassName} max-w-2xl`}>
          <h2 id="residents-title" className="flex items-center gap-2 text-lg font-semibold">
            <UsersIcon aria-hidden className="text-text-muted size-5" />
            {tResidents('title')}
          </h2>
          {streamed(<ApartmentResidentsSkeleton />, (id) => (
            <ApartmentResidents apartmentId={id} />
          ))}
        </section>
        <section aria-labelledby="fee-title" className={`${cardClassName} max-w-2xl`}>
          <h2 id="fee-title" className="flex items-center gap-2 text-lg font-semibold">
            <BanknotesIcon aria-hidden className="text-text-muted size-5" />
            {tFee('title')}
          </h2>
          {streamed(<ApartmentFeeSkeleton />, (id) => (
            <ApartmentFee apartmentId={id} />
          ))}
        </section>
      </AdminAnnouncer>
    </div>
  )
}
