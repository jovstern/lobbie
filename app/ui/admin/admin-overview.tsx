import { BuildingOffice2Icon, ChevronRightIcon, HomeModernIcon } from '@heroicons/react/24/outline'
import { getTranslations } from 'next-intl/server'
import type { ComponentType, SVGProps } from 'react'
import { requireRole } from '@/app/lib/authz'
import { hasRole } from '@/app/lib/utils/roles'
import { cardClassName } from '@/app/ui/card'
import { Link } from '@/i18n/navigation'

type OverviewLink = {
  href: string
  id: string
  label: 'buildingLink' | 'apartmentsLink'
  body: 'buildingLinkBody' | 'apartmentsLinkBody'
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

// The admin's pages alone (★); the committee's join in later milestones.
const adminLinks: OverviewLink[] = [
  {
    href: '/admin/building',
    id: 'admin-building-link',
    label: 'buildingLink',
    body: 'buildingLinkBody',
    icon: BuildingOffice2Icon,
  },
  {
    href: '/admin/apartments',
    id: 'admin-apartments-link',
    label: 'apartmentsLink',
    body: 'apartmentsLinkBody',
    icon: HomeModernIcon,
  },
]

/** `/admin` for the committee and up: a link to each admin page the member may open. */
export default async function AdminOverview() {
  // Committee and up; a resident gets the 404.
  const { role } = await requireRole('committee')
  const t = await getTranslations('Admin')
  const links = hasRole(role, 'admin') ? adminLinks : []

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-text-muted">{t('lead')}</p>
      </header>
      {links.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {links.map(({ href, id, label, body, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-labelledby={id}
                className={`${cardClassName} hover:border-text-muted h-full transition-[border-color]`}
              >
                <span className="flex items-center gap-3">
                  <Icon aria-hidden className="text-accent size-6 shrink-0" />
                  <span id={id} className="text-lg font-semibold">
                    {t(label)}
                  </span>
                  <ChevronRightIcon
                    aria-hidden
                    className="text-text-muted ms-auto size-5 shrink-0 rtl:-scale-x-100"
                  />
                </span>
                <span className="text-text-muted">{t(body)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-card bg-surface-raised border-border max-w-xl border p-6">
          {t('noToolsYet')}
        </p>
      )}
    </div>
  )
}
