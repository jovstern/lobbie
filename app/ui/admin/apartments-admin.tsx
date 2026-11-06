import { HomeModernIcon } from '@heroicons/react/24/outline'
import AdminPageHeader from '@/app/ui/admin/admin-page-header'
import { getLocale, getTranslations } from 'next-intl/server'
import { create } from '@/app/lib/actions/apartments'
import { createAll } from '@/app/lib/actions/invites'
import { requireRole } from '@/app/lib/authz'
import { list } from '@/app/lib/data/apartments'
import { get as getBuilding } from '@/app/lib/data/buildings'
import ApartmentCards from '@/app/ui/admin/apartment-cards'
import ApartmentDialog from '@/app/ui/admin/apartment-dialog'
import ApartmentTable from '@/app/ui/admin/apartment-table'
import AdminAnnouncer from '@/app/ui/admin/admin-announcer'
import InviteAll from '@/app/ui/admin/invite-all'
import EmptyState from '@/app/ui/empty-state'

/** The page's heading (in its static header), which takes focus when a dialog's button is gone. */
export const apartmentsHeadingId = 'apartments-title'

/**
 * `/admin/apartments` for an admin: invites for every apartment at once (R9), and every
 * apartment, to add, edit and remove (R8).
 */
export default async function ApartmentsAdmin() {
  // Admins only; anyone else gets the 404, before anything of the building is read.
  const { timeZone } = await requireRole('admin')
  const [apartments, building, t, locale] = await Promise.all([
    list(),
    getBuilding(),
    getTranslations('AdminApartments'),
    getLocale(),
  ])
  const addAction = create.bind(null, locale)
  const isEmpty = apartments.length === 0

  // The header comes after the role check: below admin the page names nothing.
  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={t('title')} lead={t('lead')} headingId={apartmentsHeadingId} />
      {
        <AdminAnnouncer
          headingId={apartmentsHeadingId}
          header={
            // Below the page's static header; an empty building has only the empty state.
            isEmpty ? null : (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-text-muted">{t('count', { count: apartments.length })}</p>
                {/* Secondary: inviting the building is the page's main action. */}
                <ApartmentDialog action={addAction} />
              </div>
            )
          }
        >
          {isEmpty ? (
            <EmptyState icon={HomeModernIcon} title={t('emptyTitle')} body={t('emptyBody')}>
              <ApartmentDialog action={addAction} variant="primary" focusHeadingAfterSave />
            </EmptyState>
          ) : (
            <>
              <InviteAll
                missingAction={createAll.bind(null, locale, 'missing')}
                allAction={createAll.bind(null, locale, 'all')}
                apartmentCount={apartments.length}
                activeCount={apartments.filter((apartment) => apartment.activeInvites > 0).length}
              />
              <ApartmentTable
                apartments={apartments}
                buildingMonth={building.billingStartMonth}
                timeZone={timeZone}
              />
              <ApartmentCards
                apartments={apartments}
                buildingMonth={building.billingStartMonth}
                timeZone={timeZone}
              />
            </>
          )}
        </AdminAnnouncer>
      }
    </div>
  )
}
