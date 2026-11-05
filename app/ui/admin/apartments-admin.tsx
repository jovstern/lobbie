import { HomeModernIcon } from '@heroicons/react/24/outline'
import { getLocale, getTranslations } from 'next-intl/server'
import { create } from '@/app/lib/actions/apartments'
import { createAll } from '@/app/lib/actions/invites'
import { requireRole } from '@/app/lib/authz'
import { list } from '@/app/lib/data/apartments'
import ApartmentCards from '@/app/ui/admin/apartment-cards'
import ApartmentDialog from '@/app/ui/admin/apartment-dialog'
import ApartmentTable from '@/app/ui/admin/apartment-table'
import AdminAnnouncer from '@/app/ui/admin/admin-announcer'
import InviteAll from '@/app/ui/admin/invite-all'

const headingId = 'apartments-title'

/**
 * `/admin/apartments` for an admin: invites for every apartment at once (R9), and every
 * apartment, to add, edit and remove (R8).
 */
export default async function ApartmentsAdmin() {
  // Admins only; anyone else gets the 404, before anything of the building is read.
  await requireRole('admin')
  const [apartments, t, locale] = await Promise.all([
    list(),
    getTranslations('AdminApartments'),
    getLocale(),
  ])
  const addAction = create.bind(null, locale)
  const isEmpty = apartments.length === 0

  return (
    <AdminAnnouncer
      headingId={headingId}
      header={
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            {/* Focusable from script: it takes focus when the button that had it is gone. */}
            <h1 id={headingId} tabIndex={-1} className="text-2xl font-semibold">
              {t('title')}
            </h1>
            {isEmpty ? null : (
              <p className="text-text-muted">{t('count', { count: apartments.length })}</p>
            )}
          </div>
          {isEmpty ? null : <ApartmentDialog action={addAction} variant="primary" />}
        </header>
      }
    >
      {isEmpty ? (
        <div className="rounded-card border-border bg-surface-raised flex max-w-xl flex-col items-start gap-3 border p-6">
          <HomeModernIcon aria-hidden className="text-text-muted size-8" />
          <h2 className="text-lg font-semibold">{t('emptyTitle')}</h2>
          <p className="text-text-muted">{t('emptyBody')}</p>
          <ApartmentDialog action={addAction} variant="primary" focusHeadingAfterSave />
        </div>
      ) : (
        <>
          <InviteAll
            missingAction={createAll.bind(null, locale, 'missing')}
            allAction={createAll.bind(null, locale, 'all')}
            apartmentCount={apartments.length}
            activeCount={apartments.filter((apartment) => apartment.activeInvites > 0).length}
          />
          <ApartmentTable apartments={apartments} />
          <ApartmentCards apartments={apartments} />
        </>
      )}
    </AdminAnnouncer>
  )
}
