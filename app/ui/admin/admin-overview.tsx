import { BuildingOffice2Icon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { getTranslations } from 'next-intl/server'
import { requireRole } from '@/app/lib/authz'
import { hasRole } from '@/app/lib/utils/roles'
import { cardClassName } from '@/app/ui/card'
import { Link } from '@/i18n/navigation'

/** `/admin` for the committee and up: a link to each admin page the member may open. */
export default async function AdminOverview() {
  // Committee and up; a resident gets the 404.
  const { role } = await requireRole('committee')
  const t = await getTranslations('Admin')
  // Building details are the admin's alone (★).
  const canEditBuilding = hasRole(role, 'admin')

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-text-muted">{t('lead')}</p>
      </header>
      {canEditBuilding ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <li>
            <Link
              href="/admin/building"
              aria-labelledby="admin-building-link"
              className={`${cardClassName} hover:border-text-muted h-full transition-[border-color]`}
            >
              <span className="flex items-center gap-3">
                <BuildingOffice2Icon aria-hidden className="text-accent size-6 shrink-0" />
                <span id="admin-building-link" className="text-lg font-semibold">
                  {t('buildingLink')}
                </span>
                <ChevronRightIcon
                  aria-hidden
                  className="text-text-muted ms-auto size-5 shrink-0 rtl:-scale-x-100"
                />
              </span>
              <span className="text-text-muted">{t('buildingLinkBody')}</span>
            </Link>
          </li>
        </ul>
      ) : (
        <p className="rounded-card bg-surface-raised border-border max-w-xl border p-6">
          {t('noToolsYet')}
        </p>
      )}
    </div>
  )
}
