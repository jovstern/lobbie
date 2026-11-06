import {
  BuildingOffice2Icon,
  ChevronRightIcon,
  HomeModernIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'
import { getTranslations } from 'next-intl/server'
import type { ComponentType, SVGProps } from 'react'
import { requireRole } from '@/app/lib/authz'
import { hasRole } from '@/app/lib/utils/roles'
import { cardClassName } from '@/app/ui/card'
import EmptyState from '@/app/ui/empty-state'
import { Link } from '@/i18n/navigation'

type OverviewLink = {
  href: string
  id: string
  label: 'buildingLink' | 'apartmentsLink' | 'peopleLink'
  body: 'buildingLinkBody' | 'apartmentsLinkBody' | 'peopleLinkBody'
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
  {
    href: '/admin/people',
    id: 'admin-people-link',
    label: 'peopleLink',
    body: 'peopleLinkBody',
    icon: UsersIcon,
  },
]

/** `/admin` for the committee and up: a link to each admin page the member may open. */
export default async function AdminOverview() {
  // Committee and up; a resident gets the 404.
  const { role } = await requireRole('committee')
  const t = await getTranslations('Admin')
  const links = hasRole(role, 'admin') ? adminLinks : []

  // Below the page's static header.
  return links.length > 0 ? (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {links.map(({ href, id, label, body, icon: Icon }) => (
        // The link holds only the title, so its name is its visible text; its ::after
        // covers the card, so the whole card is the target, and the card shows the focus.
        <li
          key={href}
          className={`${cardClassName} hover:border-text-muted has-active:bg-surface has-focus-visible:outline-accent relative h-full transition-[background-color,border-color] has-focus-visible:outline-2 has-focus-visible:outline-offset-2`}
        >
          <span className="flex items-center gap-3">
            <Icon aria-hidden className="text-accent size-6 shrink-0" />
            <Link
              href={href}
              aria-describedby={`${id}-body`}
              className="after:rounded-card text-lg font-semibold outline-none after:absolute after:inset-0"
            >
              {t(label)}
            </Link>
            <ChevronRightIcon
              aria-hidden
              className="text-text-muted ms-auto size-5 shrink-0 rtl:-scale-x-100"
            />
          </span>
          <span id={`${id}-body`} className="text-text-muted">
            {t(body)}
          </span>
        </li>
      ))}
    </ul>
  ) : (
    <EmptyState icon={WrenchScrewdriverIcon} title={t('noToolsTitle')} body={t('noToolsYet')} />
  )
}
