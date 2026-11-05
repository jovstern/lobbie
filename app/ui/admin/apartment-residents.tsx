import { UsersIcon } from '@heroicons/react/24/outline'
import { getLocale, getTranslations } from 'next-intl/server'
import { removeFromApartment, setOwnership } from '@/app/lib/actions/residents'
import { requireRole } from '@/app/lib/authz'
import { residentsOf } from '@/app/lib/data/apartments'
import type { Apartment } from '@/app/lib/definitions'
import OwnershipToggle from '@/app/ui/admin/ownership-toggle'
import RemoveResidentDialog from '@/app/ui/admin/remove-resident-dialog'
import { cardClassName } from '@/app/ui/card'

/**
 * The apartment's residents (R10): each one an owner or a tenant, saved as it changes, and
 * removable from the apartment; removing someone's last apartment takes them out of the
 * building, which the dialog says first.
 */
export default async function ApartmentResidents({ apartment }: { apartment: Apartment }) {
  const [member, residents, t, locale] = await Promise.all([
    requireRole('admin'),
    residentsOf(apartment.id),
    getTranslations('Residents'),
    getLocale(),
  ])

  return (
    <section aria-labelledby="residents-title" className={`${cardClassName} max-w-2xl`}>
      <h2 id="residents-title" className="flex items-center gap-2 text-lg font-semibold">
        <UsersIcon aria-hidden className="text-text-muted size-5" />
        {t('title')}
      </h2>
      {residents.length === 0 ? (
        <p className="text-text-muted">{t('empty')}</p>
      ) : (
        <ul className="divide-border flex flex-col divide-y">
          {residents.map((resident) => (
            <li
              key={resident.userId}
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 flex-col">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {resident.name}
                  {resident.userId === member.userId ? (
                    <span className="bg-surface border-border text-text-muted rounded-full border px-2 text-xs font-medium">
                      {t('you')}
                    </span>
                  ) : null}
                </p>
                {/* Addresses read left to right in both languages. */}
                <p dir="ltr" className="text-text-muted text-sm break-all rtl:text-end">
                  {resident.email}
                </p>
              </div>
              <div className="flex flex-wrap items-start gap-3">
                <OwnershipToggle
                  action={setOwnership.bind(null, locale, resident.userId, apartment.id)}
                  isOwner={resident.isOwner}
                  name={resident.name}
                  userId={resident.userId}
                />
                <RemoveResidentDialog
                  action={removeFromApartment.bind(null, locale, resident.userId, apartment.id)}
                  name={resident.name}
                  number={apartment.number}
                  leavesBuilding={resident.apartmentCount <= 1}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
